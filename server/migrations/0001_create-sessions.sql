-- Up Migration

CREATE TABLE sessions (
    ses_id     VARCHAR(255) NOT NULL PRIMARY KEY,
    data       JSONB        NOT NULL,
    expires_at TIMESTAMPTZ
);

CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

COMMENT ON TABLE sessions IS 'User sessions of the UI server (BFF), stored by @fastify/session (src/plugins/pg-session-store.ts). They hold the OIDC tokens, never sent to the browser.';
COMMENT ON COLUMN sessions.ses_id IS 'Session ID, sent to the browser in the signed session cookie.';
COMMENT ON COLUMN sessions.data IS 'Session data serialized by @fastify/session: the OIDC tokens (access, refresh and ID) under "token", and the cookie options under "cookie".';
COMMENT ON COLUMN sessions.expires_at IS 'Expiration of the session cookie: the session is never read after it, and deleted at the next login. NULL for a session without expiration.';
COMMENT ON INDEX sessions_expires_at_idx IS 'Finds the expired sessions, to ignore and delete them.';

-- Down Migration

DROP TABLE sessions;
