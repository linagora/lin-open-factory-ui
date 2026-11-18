/*
 * Copyright (C) 2026 Linagora
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
 * Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
 * any later version, provided you comply with the Additional Terms applicable for LinOpenFactoryUi software by
 * LINAGORA pursuant to Section 7 of the GNU Affero General Public License, subsections (b), (c), and (e), pursuant to
 * which these Appropriate Legal Notices must notably (i) retain the display of the "LinID™" trademark/logo at the top
 * of the interface window, the display of the “You are using the Open Source and free version of LinID™, powered by
 * Linagora © 2009–2013. Contribute to LinID R&D by subscribing to an Enterprise offer!” infobox and in the e-mails
 * sent with the Program, notice appended to any type of outbound messages (e.g. e-mail and meeting requests) as well
 * as in the LinOpenFactoryUi user interface, (ii) retain all hypertext links between LinOpenFactoryUi
 * and https://linid.org/, as well as between LINAGORA and LINAGORA.com, and (iii) refrain from infringing LINAGORA
 * intellectual property rights over its trademarks and commercial brands. Other Additional Terms apply, see
 * <http://www.linagora.com/licenses/> for more details.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License and its applicable Additional Terms for
 * LinOpenFactoryUi along with this program. If not, see <http://www.gnu.org/licenses/> for the GNU Affero
 * General Public License version 3 and <http://www.linagora.com/licenses/> for the Additional Terms applicable to the
 * LinOpenFactoryUi software.
 */

import type { Token } from '@fastify/oauth2';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { GuardHook } from './security.js';

/** Base path of the routes, under the prefix of the backend client of the SPA (`baseURL` of `src/boot/axios.ts`). */
const BASE_PATH = '/backend/user-preferences';

/** Format of a preference key: letters and digits, separated by single `-`, `_` or `.`, e.g. `table.users-columns`. */
const KEY_PATTERN = '^[a-zA-Z0-9]+([-_.][a-zA-Z0-9]+)*$';

/** JSON schema of a preference key. */
const keySchema = {
  type: 'string',
  pattern: KEY_PATTERN,
} as const;

/** User preference, as sent and returned by the API. */
interface UserPreference {
  /** Preference key, unique per user. */
  key: string;
  /** Preference value, free text. */
  value: string;
}

/** Request of `POST /backend/user-preferences`. */
interface SaveRequest {
  /** Preference to create or update. */
  Body: UserPreference;
}

/** Request of `DELETE /backend/user-preferences/:key`. */
interface DeleteRequest {
  /** Path parameters. */
  Params: {
    /** Key of the preference to delete. */
    key: string;
  };
}

/** Claims of an ID token read by the server. */
interface IdTokenClaims {
  /** Subject: identifier of the user at the identity provider. */
  sub?: unknown;
}

/** Row of the `user_preferences` table, as read by the routes. */
interface UserPreferenceRow {
  /** Preference key. */
  key: string;
  /** Preference value. */
  value: string;
}

/**
 * Gives the subject (`sub` claim) of the ID token of the session. The ID token is not verified: the server received it
 * from the token endpoint of the identity provider over TLS, and it never comes from the browser.
 *
 * @param token - Tokens of the session.
 * @returns The subject, or `null` if the ID token is missing or has no subject.
 */
export function getSubject(token: Token | undefined): string | null {
  const payload = token?.id_token?.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const { sub } = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as IdTokenClaims;
    return typeof sub === 'string' && sub !== '' ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Registers the routes managing the preferences of the logged-in user, stored in the `user_preferences` table:
 *
 * - `GET /backend/user-preferences`: all the preferences, as a `{ key: value }` object;
 * - `POST /backend/user-preferences`: creates or updates a preference (`{ key, value }`), answers `201` with it;
 * - `DELETE /backend/user-preferences/:key`: deletes a preference, answers `204`, or `404` if it does not exist.
 *
 * The user is always the one of the session (subject of its ID token), never taken from the request: a user only reads
 * and changes their own preferences. Every route goes through the session guard, like the proxies with
 * `withAccessToken` (`403` cross-site writes, `401` when the user is not logged in), then answers `401` if the ID token
 * has no subject. These routes take precedence over the `/backend` proxy.
 *
 * @param app - Fastify instance to configure, in the scope of the session.
 * @param pool - Pool of connections to the database of the server.
 * @param sessionGuard - Hook of the routes needing a logged-in user (`createSessionGuard`).
 */
export function registerUserPreferences(
  app: FastifyInstance,
  pool: pg.Pool,
  sessionGuard: GuardHook
): void {
  // Own scope: the hooks apply to every route below, and to them only
  app.register(async (scope) => {
    scope.decorateRequest('userId', '');
    scope.addHook('preHandler', sessionGuard);
    scope.addHook('preHandler', async (request, reply) => {
      // The subject never changes on renewal, the ID token of the session is enough
      const userId = getSubject(request.session.token);
      if (!userId) {
        return reply.code(401).send({ message: 'Authentication failed' });
      }
      request.userId = userId;
      return undefined;
    });
    registerRoutes(scope, pool);
  });
}

/**
 * Registers the routes of `registerUserPreferences`, for the user of `request.userId`.
 *
 * @param app - Scope of the routes, whose hooks set `request.userId`.
 * @param pool - Pool of connections to the database of the server.
 */
function registerRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get(
    BASE_PATH,
    {
      schema: {
        response: {
          200: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
    },
    async (request) => {
      const { rows } = await pool.query<UserPreferenceRow>(
        `SELECT usp_key AS key, usp_value AS value FROM user_preferences
         WHERE user_id = $1`,
        [request.userId]
      );
      return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
    }
  );

  app.post<SaveRequest>(
    BASE_PATH,
    {
      schema: {
        body: {
          type: 'object',
          required: ['key', 'value'],
          properties: {
            key: keySchema,
            // Not blank
            value: { type: 'string', pattern: '\\S' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { key, value } = request.body;
      // Atomic upsert: two saves of the same key at the same time cannot both insert
      const { rows } = await pool.query<UserPreferenceRow>(
        `INSERT INTO user_preferences (user_id, usp_key, usp_value) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, usp_key)
         DO UPDATE SET usp_value = EXCLUDED.usp_value, update_date = now()
         RETURNING usp_key AS key, usp_value AS value`,
        [request.userId, key, value]
      );
      return reply.code(201).send(rows[0]);
    }
  );

  app.delete<DeleteRequest>(`${BASE_PATH}/:key`, async (request, reply) => {
    const { rowCount } = await pool.query(
      'DELETE FROM user_preferences WHERE user_id = $1 AND usp_key = $2',
      [request.userId, request.params.key]
    );
    if (!rowCount) {
      return reply
        .code(404)
        .send({ message: `User preference not found: ${request.params.key}` });
    }
    return reply.code(204).send();
  });
}
