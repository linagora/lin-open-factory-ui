-- ============================================================================
-- LemonLDAP::NG database
-- ============================================================================
-- Database and dedicated user of LemonLDAP::NG, which authenticates the users of the E2E environment.
-- In production, passwords should be managed through secrets.
-- ============================================================================

CREATE DATABASE lemon;

CREATE ROLE lemon_user WITH LOGIN PASSWORD 'password';

ALTER DATABASE lemon OWNER TO lemon_user;

\connect lemon

GRANT USAGE ON SCHEMA public TO lemon_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLES
    TO lemon_user;

-- ============================================================================
-- Test accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS lemonldap_accounts (
    username VARCHAR(255) NOT NULL PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    cn       VARCHAR(255),
    mail     VARCHAR(255),
    roles    VARCHAR(255)
);

INSERT INTO lemonldap_accounts (username, password, cn, mail, roles) VALUES ('admin', 'password', 'admin name', 'admin@example.com', 'admin,user');
INSERT INTO lemonldap_accounts (username, password, cn, mail, roles) VALUES ('user1', 'password', 'user1 name', 'user1@example.com', 'user');
