-- Up Migration

CREATE TABLE user_preferences (
    usp_id      UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(255) NOT NULL,
    usp_key     TEXT         NOT NULL,
    usp_value   TEXT         NOT NULL,
    insert_date TIMESTAMPTZ  NOT NULL DEFAULT now(),
    update_date TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT user_preferences_user_id_key_uk UNIQUE (user_id, usp_key)
);

COMMENT ON TABLE user_preferences IS 'Key/value preferences of the users (e.g. language, theme), managed by the UI server (src/plugins/user-preferences.ts). A user only reads and writes their own preferences: the user is always taken from the tokens of the session, never from the request.';
COMMENT ON COLUMN user_preferences.usp_id IS 'Primary key, generated.';
COMMENT ON COLUMN user_preferences.user_id IS 'Subject ("sub" claim of the ID token) of the user owning the preference, as given by the identity provider.';
COMMENT ON COLUMN user_preferences.usp_key IS 'Preference key (e.g. theme, language), unique per user.';
COMMENT ON COLUMN user_preferences.usp_value IS 'Preference value, plain text.';
COMMENT ON COLUMN user_preferences.insert_date IS 'Creation date of the preference.';
COMMENT ON COLUMN user_preferences.update_date IS 'Date of the last change of the value, set by the server on each save.';
COMMENT ON CONSTRAINT user_preferences_user_id_key_uk ON user_preferences IS 'One value per key and per user. Its index also serves the lookups of all the preferences of a user (leading column).';

-- Down Migration

DROP TABLE user_preferences;
