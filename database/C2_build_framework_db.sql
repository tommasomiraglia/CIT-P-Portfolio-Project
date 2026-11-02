DROP TABLE IF EXISTS generes_user        CASCADE;
DROP TABLE IF EXISTS bookmarking_title   CASCADE;
DROP TABLE IF EXISTS bookmarking_person  CASCADE;
DROP TABLE IF EXISTS rating_history      CASCADE;
DROP TABLE IF EXISTS history_title_basic CASCADE;
DROP TABLE IF EXISTS history_name_basic  CASCADE;
DROP TABLE IF EXISTS history            CASCADE;
DROP TABLE IF EXISTS app_user            CASCADE;

-- 1. Users
CREATE TABLE app_user (
    userid        SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    password      TEXT NOT NULL,
    phonenumber   TEXT,
    langid        INTEGER REFERENCES language (langid),
    regionid      INTEGER REFERENCES region (regionid)
);

-- 2. Search history

-- "historyid is a surrogate key. 
-- "now() used to return the same value for every statemant in one transaction
-- so "(userid, time) was not unique"

CREATE TABLE history (
    historyid BIGSERIAL PRIMARY KEY,
    userid   INTEGER   NOT NULL REFERENCES app_user (userid) ON DELETE CASCADE,
    time     TIMESTAMP NOT NULL DEFAULT clock_timestamp(),
    value    TEXT NOT NULL
);

CREATE TABLE history_name_basic (
    historyid   BIGINT   NOT NULL REFERENCES history (historyid) ON DELETE CASCADE,
    nconst   VARCHAR(10) NOT NULL REFERENCES name_basics (nconst),
    PRIMARY KEY (historyid, nconst)
);

CREATE TABLE history_title_basic (
    historyid   BIGINT   NOT NULL REFERENCES history (historyid) ON DELETE CASCADE,
    tconst   VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    PRIMARY KEY (historyid, tconst)
);

-- 3. Rating history
CREATE TABLE rating_history (
    userid    INTEGER     NOT NULL REFERENCES app_user (userid) ON DELETE CASCADE,
    tconst    VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    value     SMALLINT    NOT NULL CHECK (value BETWEEN 1 AND 10),
    comment   TEXT,
    PRIMARY KEY (userid, tconst)
);

-- 4. Bookmarking
CREATE TABLE bookmarking_person (
    userid   INTEGER     NOT NULL REFERENCES app_user (userid) ON DELETE CASCADE,
    nconst   VARCHAR(10) NOT NULL REFERENCES name_basics (nconst),
    PRIMARY KEY (userid, nconst)
);

CREATE TABLE bookmarking_title (
    userid   INTEGER     NOT NULL REFERENCES app_user (userid) ON DELETE CASCADE,
    tconst   VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    PRIMARY KEY (userid, tconst)
);

-- 5. Genre preferences
CREATE TABLE generes_user (
    userid     INTEGER NOT NULL REFERENCES app_user (userid) ON DELETE CASCADE,
    genereid   INTEGER NOT NULL REFERENCES generes (genereid),
    PRIMARY KEY (userid, genereid)
);