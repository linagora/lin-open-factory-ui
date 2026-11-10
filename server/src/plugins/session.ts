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

import { fileURLToPath } from 'node:url';
import { fastifyCookie } from '@fastify/cookie';
import { fastifySession } from '@fastify/session';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { runner } from 'node-pg-migrate';
import type { ServerConfig } from '../config/schema.js';
import { PgSessionStore } from './pg-session-store.js';

/**
 * Applies the migrations of `server/migrations` not applied yet, in the order of their number, and records them in the
 * `session.migrations.table` table. They run with their own connection, as the user of `session.migrations.database`
 * (the owner of the database), so that the user of the sessions only reads and writes data. An advisory lock makes the
 * servers starting at the same time apply them once, one after the other.
 *
 * @param session - Configuration of the session.
 * @param log - Logger of the migrations.
 */
async function migrate(
  session: ServerConfig['session'],
  log: FastifyBaseLogger
): Promise<void> {
  await runner({
    databaseUrl: { ...session.database, ...session.migrations?.database },
    dir: fileURLToPath(new URL('../../migrations', import.meta.url)),
    direction: 'up',
    migrationsTable: session.migrations?.table ?? 'pgmigrations',
    // The servers starting meanwhile wait for the migrations to end, instead of failing
    advisoryLockMode: 'wait',
    logger: log,
  });
}

/**
 * Registers the user session, stored in PostgreSQL and identified by a cookie.
 *
 * @param app - Fastify instance to configure.
 * @param config - Server configuration.
 * @returns The store of the sessions.
 */
export function registerSession(
  app: FastifyInstance,
  config: ServerConfig
): PgSessionStore {
  const store = new PgSessionStore(config.session.database, app.log);
  app.addHook('onReady', () => migrate(config.session, app.log));
  app.addHook('onClose', () => store.close());
  app.register(fastifyCookie);
  app.register(fastifySession, {
    store,
    secret: config.session.secret,
    cookieName: config.session.cookieName,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      sameSite: config.session.sameSite ?? 'lax',
      secure: config.session.secure ?? true,
      maxAge: config.session.maxAgeMilliseconds,
    },
  });
  return store;
}
