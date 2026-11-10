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

import { fastifyOauth2, type Token } from '@fastify/oauth2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ServerConfig } from '../config/schema.js';
import type { PgSessionStore } from './pg-session-store.js';

/** Error thrown by the OAuth 2 client when the identity provider refuses a request. */
interface OAuth2Error {
  /** Answer of the identity provider. */
  data?: {
    /** Body of the answer. */
    payload?: {
      /** OAuth 2 error code, e.g. `invalid_grant`. */
      error?: string;
    };
  };
}

/** Request of `GET /auth/login`. */
interface LoginRequest {
  /** Query string. */
  Querystring: {
    /** Path of the SPA to go back to after the login. */
    returnTo?: string;
  };
}

/**
 * Registers the OpenID Connect authentication routes under `/auth`, with `@fastify/oauth2`.
 *
 * @param app - Fastify instance to configure.
 * @param config - Server configuration.
 * @param sessionStore - Store of the sessions, locking a session while its tokens are renewed.
 * @returns A function giving the access token of the user session, refreshed if it expires soon.
 */
export function registerAuth(
  app: FastifyInstance,
  config: ServerConfig,
  sessionStore: PgSessionStore
) {
  const { oidc } = config;
  const refreshMargin = oidc.refreshMarginMilliseconds ?? 30_000;

  app.register(fastifyOauth2, {
    ...oidc.oauth2,
    name: 'oidc',
  });

  /**
   * Tells whether a token expires in more than the refresh margin.
   *
   * @param token - Token to check.
   * @returns `true` if the token can be used without renewal.
   */
  const isFresh = (token: Token) =>
    new Date(token.expires_at).getTime() - refreshMargin > Date.now();

  /**
   * Returns the access token of the user session.
   *
   * @param request - Request of the user.
   * @returns The access token, or `null` if the user is not logged in.
   */
  async function getFreshAccessToken(
    request: FastifyRequest
  ): Promise<string | null> {
    const { token } = request.session;
    if (!token) {
      return null;
    }
    if (isFresh(token)) {
      return token.access_token;
    }

    try {
      // The session is locked in the database: the requests renewing it at the same time, on any server, wait, then
      // get the token saved by the first one instead of reusing a refresh token already revoked
      const newToken = await sessionStore.updateToken(
        request.session.sessionId,
        async (savedToken) => {
          if (!savedToken || isFresh(savedToken)) {
            return savedToken;
          }
          const { token: renewed } =
            await app.oidc.getNewAccessTokenUsingRefreshToken(savedToken, {});
          return {
            ...renewed,
            refresh_token: renewed.refresh_token ?? savedToken.refresh_token,
            id_token: renewed.id_token ?? savedToken.id_token,
          };
        }
      );
      // The session was deleted meanwhile (e.g. logout) or has expired
      if (!newToken) {
        return null;
      }
      // The new token is already saved: the session of the request is left unchanged, so that it is not saved again,
      // which would bring back a session deleted meanwhile
      return newToken.access_token;
    } catch (error) {
      // Error of the OAuth 2 client, carrying the answer of the identity provider
      const providerError = (error as OAuth2Error | undefined)?.data?.payload
        ?.error;
      if (providerError !== 'invalid_grant') {
        throw error;
      }
      request.log.info('Refresh token rejected, session deleted');
      await request.session.destroy();
      return null;
    }
  }

  app.get<LoginRequest>(
    '/auth/login',
    async (request: FastifyRequest<LoginRequest>, reply: FastifyReply) => {
      reply.setCookie('returnTo', request.query.returnTo ?? '/', {
        ...oidc.oauth2.cookie,
        path: '/auth',
      });
      return reply.redirect(
        await app.oidc.generateAuthorizationUri(request, reply)
      );
    }
  );

  app.get('/auth/callback', async (request, reply: FastifyReply) => {
    // The SSO redirects to this route when the user has authenticated
    const returnTo = request.cookies.returnTo ?? '/';
    reply.clearCookie('returnTo', { path: '/auth' });
    try {
      // Checks the state, then exchanges the authorization code for tokens
      const { token } = await app.oidc.getAccessTokenFromAuthorizationCodeFlow(
        request,
        reply
      );
      await request.session.regenerate();
      request.session.token = token;
      // Parses returnTo like the browsers
      const returnUrl = URL.parse(returnTo, 'http://localhost');
      if (returnUrl?.origin !== 'http://localhost') {
        return reply.redirect('/');
      }
      return reply.redirect(
        returnUrl.pathname + returnUrl.search + returnUrl.hash
      );
    } catch (error) {
      request.log.warn({ err: error }, 'Login callback failed');
      return reply.code(400).send({ message: 'Authentication failed' });
    }
  });

  app.get('/auth/logout', async (request, reply) => {
    const logoutUrl = new URL(oidc.logoutUrl);
    logoutUrl.searchParams.set(
      'post_logout_redirect_uri',
      oidc.postLogoutRedirectUri
    );
    const idToken = request.session.token?.id_token;
    if (idToken) {
      logoutUrl.searchParams.set('id_token_hint', idToken);
    }

    // Removes the session from the store
    await request.session.destroy();
    // Ask the browser to clear the session cookie
    reply.clearCookie(config.session.cookieName, { path: '/' });
    return reply.redirect(logoutUrl.href);
  });

  // The SSO redirects to this route after the logout
  app.get('/auth/logged-out', async (_request, reply) =>
    reply.redirect('/auth/login')
  );

  return getFreshAccessToken;
}
