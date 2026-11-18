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

import {
  fastifyHttpProxy,
  type FastifyHttpProxyOptions,
} from '@fastify/http-proxy';
import type { FastifyInstance } from 'fastify';
import type { ServerConfig } from '../config/schema.js';
import type { GuardHook } from './security.js';

/**
 * Removes a cookie from a `Cookie` header, keeping the other cookies.
 *
 * @param cookieHeader - Value of the `Cookie` header.
 * @param name - Name of the cookie to remove.
 * @returns The `Cookie` header without the cookie, or `undefined` if no cookie is left.
 */
function removeCookie(
  cookieHeader: string | undefined,
  name: string
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  // The browsers separate the cookies with "; "
  const otherCookies = cookieHeader
    .split('; ')
    .filter((cookie) => !cookie.startsWith(`${name}=`));

  if (otherCookies.length === 0) {
    return undefined;
  }
  return otherCookies.join('; ');
}

/**
 * Registers the reverse proxies declared in `proxies` with `withAccessToken` when `sessionGuard` is given (in the scope
 * of the session), the others otherwise (out of it, without database query). The routes with `withAccessToken` go
 * through the session guard (`403` cross-site writes, `401` when the user is not logged in), then send the access token
 * of the user session to the upstream.
 *
 * @param app - Fastify instance to configure.
 * @param config - Server configuration.
 * @param sessionGuard - Hook of the routes needing a logged-in user (`createSessionGuard`). Omitted to register the
 *   routes without `withAccessToken`.
 */
export function registerProxies(
  app: FastifyInstance,
  config: ServerConfig,
  sessionGuard?: GuardHook
): void {
  config.proxies
    .filter((route) => !route.withAccessToken === !sessionGuard)
    .map((route): FastifyHttpProxyOptions => ({
      prefix: route.prefix,
      upstream: route.upstream,
      rewritePrefix:
        route.rewritePrefix ?? (route.keepPrefix ? route.prefix : undefined),
      preHandler: sessionGuard
        ? async (request, reply) => {
            const refused = await sessionGuard(request, reply);
            if (refused) {
              return refused;
            }
            request.headers.authorization = `Bearer ${request.accessToken}`;
            // The upstream is authenticated by the access token, it does not need the cookies of the browser
            delete request.headers.cookie;
          }
        : undefined,
      replyOptions: {
        rewriteRequestHeaders: (request, headers) => ({
          ...headers,
          // The session cookie is only meant for this server, the other cookies are kept (e.g. those of LemonLDAP::NG)
          cookie: removeCookie(headers.cookie, config.session.cookieName),
          host: request.host,
          'x-real-ip': request.ip,
          'x-forwarded-for': headers['x-forwarded-for']
            ? `${headers['x-forwarded-for']}, ${request.ip}`
            : request.ip,
          'x-forwarded-proto': request.protocol,
        }),
      },
    }))
    .forEach((options) => app.register(fastifyHttpProxy, options));
}
