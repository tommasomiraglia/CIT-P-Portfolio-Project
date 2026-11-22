-- Least privilege role for the backend on the course database cit16.
-- The API connects as cit16_app instead of cit16 (the owner of every table), so it can only read
-- the IMDB data, write the framework data and call the functions, but it cannot create, alter or
-- drop tables, functions and so on.
--
-- Roles belong to the whole server, not to one database, and other groups share cit.ruc.dk.
-- The prefix keeps the name from clashing with another group's role.
--
-- Run it as cit16, from the university network or its VPN:
--   psql "host=cit.ruc.dk dbname=cit16 user=cit16 sslmode=require" -v app_password=<new password> -f database/G1_app_role.sql
-- Then set DB_USER=cit16_app and DB_PASSWORD=<new password> in backend/.env.
--
-- CREATE ROLE needs the CREATEROLE privilege. If cit16 does not have it, the script stops at the
-- first statement and the course admin has to create the role.

-- Stop at the first error instead of running the grants against a role that is not there.
\set ON_ERROR_STOP on

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cit16_app') THEN
        CREATE ROLE cit16_app LOGIN;
    END IF;
END
$$;
ALTER ROLE cit16_app PASSWORD :'app_password';

GRANT CONNECT ON DATABASE cit16 TO cit16_app;
GRANT USAGE ON SCHEMA public TO cit16_app;

-- Nobody but the owner may create objects in public.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Read: every table, IMDB data and framework data.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cit16_app;

-- Write: only the tables that the functions in D1 change.
GRANT INSERT, UPDATE, DELETE ON
    app_user,
    bookmarking_title,
    bookmarking_person,
    history,
    generes_user,
    rating_history,
    title_ratings,
    name_ratings
TO cit16_app;

-- The next id for app_user and history comes from their sequences (SERIAL, BIGSERIAL).
GRANT USAGE ON SEQUENCE app_user_userid_seq, history_historyid_seq TO cit16_app;

-- The API only calls the functions of D1.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO cit16_app;
