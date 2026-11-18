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

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** `preHandler` hook refusing a request: it answers, then returns the reply, or returns `undefined` to go on. */
export type GuardHook = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<FastifyReply | undefined>;

/** Methods that change data, refused when the request comes from another site (CSRF). */
export const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Tells if a request comes from a page of this server: by `Sec-Fetch-Site` when the browser sends it, otherwise by
 * comparing `Origin` to the origin of the server. A request with neither header is refused.
 *
 * @param request - Incoming request.
 * @returns `true` if the request comes from this server.
 */
export function isSameOrigin(request: FastifyRequest): boolean {
  const fetchSite = request.headers['sec-fetch-site'];
  if (fetchSite) {
    return fetchSite === 'same-origin';
  }
  return request.headers.origin === `${request.protocol}://${request.host}`;
}

/**
 * Tells if a request must be refused as a cross-site request forgery: a method changing data sent from another site.
 *
 * @param request - Incoming request.
 * @returns `true` if the request must be refused.
 */
export function isCrossSiteWrite(request: FastifyRequest): boolean {
  return UNSAFE_METHODS.includes(request.method) && !isSameOrigin(request);
}

/**
 * Creates the `preHandler` hook of the routes needing a logged-in user, like the `withAccessToken` proxies: it answers
 * `403` to the `POST`, `PUT`, `PATCH` and `DELETE` requests coming from another site, renews the access token of the
 * session if it expires soon, and answers `401` if the user is not logged in. Otherwise, it sets
 * `request.accessToken`.
 *
 * @param app - Fastify instance of the session scope, where `request.accessToken` is declared.
 * @param getFreshAccessToken - Gives the access token of the user session, or `null` if the user is not logged in.
 * @returns The hook.
 */
export function createSessionGuard(
  app: FastifyInstance,
  getFreshAccessToken: (request: FastifyRequest) => Promise<string | null>
): GuardHook {
  app.decorateRequest('accessToken', '');
  return async (request, reply) => {
    // Sec-Fetch-Site is set by the browser: same-origin means a page of this server
    if (isCrossSiteWrite(request)) {
      return reply.code(403).send({ message: 'Cross-site request refused' });
    }
    const accessToken = await getFreshAccessToken(request);
    if (!accessToken) {
      return reply.code(401).send({ message: 'Authentication failed' });
    }
    request.accessToken = accessToken;
    return undefined;
  };
}
