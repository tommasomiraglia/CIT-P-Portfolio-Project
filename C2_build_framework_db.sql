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
CREATE TABLE history (
    userid   INTEGER   NOT NULL REFERENCES app_user (userid),
    time     TIMESTAMP NOT NULL DEFAULT now(),
    value    TEXT,
    PRIMARY KEY (userid, time)
);

CREATE TABLE history_name_basic (
    userid   INTEGER   NOT NULL,
    time     TIMESTAMP NOT NULL,
    nconst   VARCHAR(10) NOT NULL REFERENCES name_basics (nconst),
    PRIMARY KEY (userid, time, nconst),
    FOREIGN KEY (userid, time) REFERENCES history (userid, time) ON DELETE CASCADE
);

CREATE TABLE history_title_basic (
    userid   INTEGER   NOT NULL,
    time     TIMESTAMP NOT NULL,
    tconst   VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    PRIMARY KEY (userid, time, tconst),
    FOREIGN KEY (userid, time) REFERENCES history (userid, time) ON DELETE CASCADE
);

-- 3. Rating history
CREATE TABLE rating_history (
    userid    INTEGER     NOT NULL REFERENCES app_user (userid),
    tconst    VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    value     SMALLINT    NOT NULL CHECK (value BETWEEN 1 AND 10),
    comment   TEXT,
    PRIMARY KEY (userid, tconst)
);

-- 4. Bookmarking
CREATE TABLE bookmarking_person (
    userid   INTEGER     NOT NULL REFERENCES app_user (userid),
    nconst   VARCHAR(10) NOT NULL REFERENCES name_basics (nconst),
    PRIMARY KEY (userid, nconst)
);

CREATE TABLE bookmarking_title (
    userid   INTEGER     NOT NULL REFERENCES app_user (userid),
    tconst   VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    PRIMARY KEY (userid, tconst)
);

-- 5. Genre preferences
CREATE TABLE generes_user (
    userid     INTEGER NOT NULL REFERENCES app_user (userid),
    genereid   INTEGER NOT NULL REFERENCES generes (genereid),
    PRIMARY KEY (userid, genereid)
);