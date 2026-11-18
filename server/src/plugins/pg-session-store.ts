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
import type { SessionStore } from '@fastify/session';
import type { FastifyBaseLogger, Session } from 'fastify';
import type pg from 'pg';

/** Row of the `sessions` table, as read by the store. */
interface SessionRow {
  /** Session data. */
  data: Session;
}

/**
 * Store of `@fastify/session` keeping the sessions in the `sessions` table of PostgreSQL, created by the migrations. A
 * session expires with its cookie: the expired sessions are never returned, and are deleted at each login.
 */
export class PgSessionStore implements SessionStore {
  /** Pool of connections to the database. */
  private readonly pool: pg.Pool;

  /** Logger of the database errors. */
  private readonly log: FastifyBaseLogger;

  /**
   * Creates the store.
   *
   * @param pool - Pool of connections to the database (`plugins/database.ts`), closed by its owner.
   * @param log - Logger of the database errors.
   */
  constructor(pool: pg.Pool, log: FastifyBaseLogger) {
    this.pool = pool;
    this.log = log;
  }

  /**
   * Saves the session data, without the references of the session to the request.
   *
   * @param sessionId - Session ID.
   * @param session - Session to save.
   * @param callback - Called once the session is saved.
   */
  set(
    sessionId: string,
    session: Session,
    callback: (error?: unknown) => void
  ): void {
    const data = JSON.stringify(session);
    // ponytail: purge at each login (the renewals use updateToken), move to a scheduled job if the table grows large
    // Best-effort: a failed purge must not fail the login
    this.pool
      .query('DELETE FROM sessions WHERE expires_at <= now()')
      .catch((error: unknown) =>
        this.log.warn({ err: error }, 'Purge of the expired sessions failed')
      )
      .then(() =>
        this.pool.query(
          `INSERT INTO sessions (ses_id, data, expires_at) VALUES ($1, $2, $3)
           ON CONFLICT (ses_id) DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at`,
          [sessionId, data, session.cookie.expires]
        )
      )
      .then(() => callback(), callback);
  }

  /**
   * Gives a session.
   *
   * @param sessionId - Session ID.
   * @param callback - Called with the session, or `undefined` if it does not exist or has expired.
   */
  get(
    sessionId: string,
    callback: (error: unknown, session?: Session) => void
  ): void {
    this.pool
      .query<SessionRow>(
        'SELECT data FROM sessions WHERE ses_id = $1 AND expires_at > now()',
        [sessionId]
      )
      .then(({ rows }) => callback(null, rows[0]?.data), callback);
  }

  /**
   * Deletes a session.
   *
   * @param sessionId - Session ID.
   * @param callback - Called once the session is deleted.
   */
  destroy(sessionId: string, callback: (error?: unknown) => void): void {
    this.pool
      .query('DELETE FROM sessions WHERE ses_id = $1', [sessionId])
      .then(() => callback(), callback);
  }

  /**
   * Replaces the tokens of a session while holding a lock on it: the other calls for the same session, on this server
   * or on another one, wait until the new tokens are saved, then get them.
   *
   * @param sessionId - Session ID.
   * @param update - Called with the saved tokens (`undefined` if the session does not exist or has expired), returns
   *   the tokens to save, or the saved ones or `undefined` to save nothing.
   * @returns The tokens returned by `update`.
   */
  async updateToken(
    sessionId: string,
    update: (token?: Token) => Promise<Token | undefined>
  ): Promise<Token | undefined> {
    const client = await this.pool.connect();
    /**
     * Logs the loss of the connection. The pool removes its error listener from a checked out connection: without this
     * one, losing the connection (database restart, network) during the renewal would crash the process.
     *
     * @param error - Connection error.
     * @returns Nothing.
     */
    const onError = (error: Error) =>
      this.log.error({ err: error }, 'Database connection lost');
    client.on('error', onError);
    let releaseError: Error | undefined;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<SessionRow>(
        `SELECT data FROM sessions
         WHERE ses_id = $1 AND expires_at > now()
         FOR UPDATE`,
        [sessionId]
      );
      const savedToken = rows[0]?.data.token;
      const token = await update(savedToken);
      if (token && token !== savedToken) {
        await client.query(
          "UPDATE sessions SET data = jsonb_set(data, '{token}', $2) WHERE ses_id = $1",
          [sessionId, JSON.stringify(token)]
        );
      }
      await client.query('COMMIT');
      return token;
    } catch (error) {
      // A failed rollback must not hide the error, and its connection is closed instead of going back to the pool
      await client.query('ROLLBACK').catch((rollbackError: Error) => {
        releaseError = rollbackError;
      });
      throw error;
    } finally {
      client.off('error', onError);
      client.release(releaseError);
    }
  }
}
