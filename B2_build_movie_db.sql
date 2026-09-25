--Data Cleaning

-- removing dead dependencies
-- remove roles assigned to actors/directors missing from name_basics (378 records)
DELETE FROM title_principals tp
WHERE NOT EXISTS (
    SELECT 1 
    FROM name_basics nb 
    WHERE tp.nconst = nb.nconst
);

-- enforce mandatory 1-to-N Cardinality (Title to AKAs)
-- Architectural Decision: Since we are dropping 'originalTitle' from the 
-- main Title entity to avoid redundancy, every movie MUST have at least 
-- one corresponding record in 'title_akas'.

INSERT INTO title_akas (
    titleid, 
    ordering, 
    title, 
    region, 
    language, 
    types, 
    attributes, 
    isoriginaltitle
)
SELECT 
    tb.tconst,               
    1,                       
    tb.originaltitle,        
    NULL,                    
    NULL,                    
    'original',              
    NULL, 
    true                    
FROM title_basics tb
WHERE NOT EXISTS (
    SELECT 1 
    FROM title_akas ta 
    WHERE ta.titleid = tb.tconst
);

--RENAME
ALTER TABLE title_basics     RENAME TO raw_title_basics;
ALTER TABLE title_akas       RENAME TO raw_title_akas;
ALTER TABLE title_principals RENAME TO raw_title_principals;
ALTER TABLE title_ratings    RENAME TO raw_title_ratings;
ALTER TABLE title_episode    RENAME TO raw_title_episode;
ALTER TABLE title_crew       RENAME TO raw_title_crew;
ALTER TABLE name_basics      RENAME TO raw_name_basics;

--NEW SCHEMA

--1 small table
CREATE TABLE title_basic_type (
    titletypeid   SERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE
);
 
CREATE TABLE title_akas_type (
    titletypeid   SERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE
);
 
CREATE TABLE region (
    regionid      SERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE
);
 
CREATE TABLE language (
    langid        SERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE
);
 
CREATE TABLE category (
    categoryid    SERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE
);

CREATE TABLE primaryprofession (
    professionid    SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE
);
 
CREATE TABLE generes (
    genereid      SERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE
);

--2 core table
CREATE TABLE title_basic (
    tconst          VARCHAR(10) PRIMARY KEY,
    titletypeid     INTEGER REFERENCES title_basic_type (titletypeid),
    primarytitle    TEXT NOT NULL,
    isadult         BOOLEAN,
    startyear       SMALLINT,
    endyear         SMALLINT,
    runtimeminutes  INTEGER,
    plot            TEXT,
    poster_link     TEXT
);

CREATE TABLE title_akas (
    akasid          SERIAL PRIMARY KEY,
    titleid         VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    title           TEXT,
    attributes      TEXT
);

--TO LOOK AT
CREATE TABLE lang_reg_akas (
    id            SERIAL PRIMARY KEY,
    akasid        INTEGER NOT NULL REFERENCES title_akas (akasid),
    langid        INTEGER REFERENCES language (langid),
    titletypeid   INTEGER REFERENCES title_akas_type (titletypeid),
    regionid      INTEGER REFERENCES region (regionid),
    UNIQUE (akasid, langid, titletypeid, regionid)
);

CREATE TABLE title_ratings (
    tconst          VARCHAR(10) PRIMARY KEY REFERENCES title_basic (tconst),
    averagerating   NUMERIC(5,1),
    numvotes        INTEGER
);

CREATE TABLE title_episode (
    episodeid       VARCHAR(10) PRIMARY KEY REFERENCES title_basic (tconst),
    parentconst     VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    seasonnumber    INTEGER,
    episodenumber   INTEGER
);

CREATE TABLE generes_title_basic (
    tconst          VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    genereid        INTEGER NOT NULL REFERENCES generes (genereid),
    PRIMARY KEY (tconst, genereid)
);

--3 people table
CREATE TABLE name_basics (
    nconst          VARCHAR(10) PRIMARY KEY,
    primaryname     TEXT NOT NULL,
    birthyear       SMALLINT,
    deathyear       SMALLINT
);

CREATE TABLE name_primaryprofession (
    nconst          VARCHAR(10) NOT NULL REFERENCES name_basics (nconst),
    professionid    INTEGER NOT NULL REFERENCES primaryprofession (professionid),
    PRIMARY KEY (nconst, professionid)
);

CREATE TABLE knowfor (
    tconst          VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    nconst          VARCHAR(10) NOT NULL REFERENCES name_basics (nconst),
    PRIMARY KEY (tconst, nconst)
);

CREATE TABLE title_principals (
    principalid     SERIAL PRIMARY KEY,
    tconst          VARCHAR(10) NOT NULL REFERENCES title_basic (tconst),
    nconst          VARCHAR(10) NOT NULL REFERENCES name_basics (nconst),
    categoryid      INTEGER REFERENCES category (categoryid),
    job             TEXT,
    is_crew         BOOLEAN NOT NULL DEFAULT FALSE,
    ordering        INTEGER   
);

CREATE TABLE title_character (
    principalid     INTEGER NOT NULL REFERENCES title_principals (principalid),
    character       TEXT NOT NULL,
    PRIMARY KEY (principalid, character)
);

CREATE TABLE name_ratings (
    nconst          VARCHAR(10) PRIMARY KEY REFERENCES name_basics (nconst),
    averagerating   NUMERIC(5,1),
    agg_numvotes    INTEGER
);

--4 populate table
INSERT INTO title_basic_type (name)
SELECT DISTINCT titletype
FROM raw_title_basics
WHERE titletype IS NOT NULL;
 
INSERT INTO title_akas_type (name)
SELECT DISTINCT trim(t.val)
FROM raw_title_akas ra
CROSS JOIN LATERAL unnest(string_to_array(ra.types, ',')) AS t(val)
WHERE ra.types IS NOT NULL;
 
INSERT INTO region (name)
SELECT DISTINCT region
FROM raw_title_akas
WHERE region IS NOT NULL;
 
INSERT INTO language (name)
SELECT DISTINCT language
FROM raw_title_akas
WHERE language IS NOT NULL;
 
INSERT INTO category (name)
SELECT DISTINCT category
FROM raw_title_principals
WHERE category IS NOT NULL;
 
INSERT INTO primaryprofession (name)
SELECT DISTINCT trim(p.val)
FROM raw_name_basics nb
CROSS JOIN LATERAL unnest(string_to_array(nb.primaryprofession, ',')) AS p(val)
WHERE nb.primaryprofession IS NOT NULL;
 
INSERT INTO generes (name)
SELECT DISTINCT trim(g.val)
FROM raw_title_basics tb
CROSS JOIN LATERAL unnest(string_to_array(tb.genres, ',')) AS g(val)
WHERE tb.genres IS NOT NULL;

-- 4a. title_basic
INSERT INTO title_basic (
    tconst, titletypeid, primarytitle, isadult,
    startyear, endyear, runtimeminutes, plot, poster_link
)
SELECT
    tb.tconst,
    tbt.titletypeid,
    tb.primarytitle,
    tb.isadult,
    NULLIF(trim(tb.startyear), '\N')::SMALLINT,
    NULLIF(trim(tb.endyear), '\N')::SMALLINT,
    tb.runtimeminutes,
    od.plot,
    od.poster
FROM raw_title_basics tb
LEFT JOIN title_basic_type tbt ON tbt.name = tb.titletype
LEFT JOIN omdb_data od          ON od.tconst = tb.tconst;

-- 4b. generes_title_basic
INSERT INTO generes_title_basic (tconst, genereid)
SELECT DISTINCT tb.tconst, g.genereid
FROM raw_title_basics tb
CROSS JOIN LATERAL unnest(string_to_array(tb.genres, ',')) AS gn(val)
JOIN generes g ON g.name = trim(gn.val)
WHERE tb.genres IS NOT NULL;

-- 4c. title_akas + lang_reg_akas
INSERT INTO title_akas (akasid, titleid, title, attributes)
SELECT
    ROW_NUMBER() OVER (ORDER BY titleid, ordering) AS akasid,
    titleid,
    title,
    attributes
FROM raw_title_akas;
 
SELECT setval(
    pg_get_serial_sequence('title_akas', 'akasid'),
    (SELECT COALESCE(MAX(akasid), 1) FROM title_akas)
);
 
INSERT INTO lang_reg_akas (akasid, langid, titletypeid, regionid)
SELECT DISTINCT
    numbered.akasid,
    lang.langid,
    tat.titletypeid,
    reg.regionid
FROM (
    SELECT
        ROW_NUMBER() OVER (ORDER BY titleid, ordering) AS akasid,
        region, language, types
    FROM raw_title_akas
) AS numbered
CROSS JOIN LATERAL unnest(string_to_array(numbered.types, ',')) AS ty(val)
LEFT JOIN language      lang ON lang.name = numbered.language
LEFT JOIN title_akas_type tat ON tat.name = trim(ty.val)
LEFT JOIN region         reg  ON reg.name = numbered.region
WHERE numbered.types IS NOT NULL;

-- 4d. title_ratings
INSERT INTO title_ratings (tconst, averagerating, numvotes)
SELECT tconst, averagerating, numvotes
FROM raw_title_ratings
WHERE EXISTS (SELECT 1 FROM title_basic tb WHERE tb.tconst = raw_title_ratings.tconst);

-- 4e. title_episode
INSERT INTO title_episode (episodeid, parentconst, seasonnumber, episodenumber)
SELECT
    te.tconst,
    te.parenttconst,
    NULLIF(te.seasonnumber::TEXT, '\N')::INTEGER,
    NULLIF(te.episodenumber::TEXT, '\N')::INTEGER
FROM raw_title_episode te
WHERE EXISTS (SELECT 1 FROM title_basic tb WHERE tb.tconst = te.tconst)
  AND EXISTS (SELECT 1 FROM title_basic tb WHERE tb.tconst = te.parenttconst);

-- 4f. name_basics
INSERT INTO name_basics (nconst, primaryname, birthyear, deathyear)
SELECT
    nb.nconst,
    nb.primaryname,
    NULLIF(nb.birthyear::TEXT, '\N')::SMALLINT,
    NULLIF(nb.deathyear::TEXT, '\N')::SMALLINT
FROM raw_name_basics nb;

-- 4g. name_primaryprofession 
INSERT INTO name_primaryprofession (nconst, professionid)
SELECT DISTINCT
    nb.nconst,
    pp.professionid
FROM raw_name_basics nb
CROSS JOIN LATERAL unnest(string_to_array(nb.primaryprofession, ',')) AS pr(val)
JOIN primaryprofession pp ON pp.name = trim(pr.val)
WHERE nb.primaryprofession IS NOT NULL;

-- 4g. knowfor
INSERT INTO knowfor (tconst, nconst)
SELECT DISTINCT kt.val, nb.nconst
FROM raw_name_basics nb
CROSS JOIN LATERAL unnest(string_to_array(nb.knownfortitles, ',')) AS kt(val)
WHERE nb.knownfortitles IS NOT NULL
  AND EXISTS (SELECT 1 FROM title_basic tb WHERE tb.tconst = kt.val)
  AND EXISTS (SELECT 1 FROM name_basics n2 WHERE n2.nconst = nb.nconst);

-- 4h. title_principals
-- is_crew tracks which raw table a row came from:
--   FALSE -> came from raw_title_principals 
--   TRUE  -> came from raw_title_crew 
-- 4h-i. insert all rows from raw_title_principals (primary source)
INSERT INTO title_principals (tconst, nconst, categoryid, job, is_crew, ordering)
SELECT
    tp.tconst,
    tp.nconst,
    c.categoryid,
    tp.job,
    FALSE, 
    NULLIF(tp.ordering::TEXT, '\N')::INTEGER
FROM raw_title_principals tp
JOIN category c ON c.name = tp.category
WHERE EXISTS (SELECT 1 FROM title_basic tb WHERE tb.tconst = tp.tconst)
  AND EXISTS (SELECT 1 FROM name_basics nb WHERE nb.nconst = tp.nconst);

-- 4h-ii. flag is_crew = TRUE on existing 'director' rows also confirmed by raw_title_crew
UPDATE title_principals tpn
SET is_crew = TRUE
FROM category c
WHERE tpn.categoryid = c.categoryid
  AND c.name = 'director'
  AND EXISTS (
      SELECT 1
      FROM raw_title_crew tcw
      CROSS JOIN LATERAL unnest(string_to_array(tcw.directors, ',')) AS d(val)
      WHERE tcw.tconst = tpn.tconst
        AND d.val = tpn.nconst
  );

-- 4h-iii. same for 'writer'
UPDATE title_principals tpn
SET is_crew = TRUE
FROM category c
WHERE tpn.categoryid = c.categoryid
  AND c.name = 'writer'
  AND EXISTS (
      SELECT 1
      FROM raw_title_crew tcw
      CROSS JOIN LATERAL unnest(string_to_array(tcw.writers, ',')) AS w(val)
      WHERE tcw.tconst = tpn.tconst
        AND w.val = tpn.nconst
  );

-- 4h-iv. insert directors/writers NOT already present in raw_title_principals
INSERT INTO title_principals (tconst, nconst, categoryid, job, is_crew, ordering)
SELECT DISTINCT
    combined.tconst,
    combined.nconst,
    c.categoryid,
    NULL,
    TRUE,
    combined.pos::INTEGER
FROM (
    SELECT tcw.tconst, d.val AS nconst, d.pos, 'director' AS role
    FROM raw_title_crew tcw
    CROSS JOIN LATERAL unnest(string_to_array(tcw.directors, ',')) WITH ORDINALITY AS d(val, pos)
    WHERE tcw.directors IS NOT NULL

    UNION ALL

    SELECT tcw.tconst, w.val AS nconst, w.pos, 'writer' AS role
    FROM raw_title_crew tcw
    CROSS JOIN LATERAL unnest(string_to_array(tcw.writers, ',')) WITH ORDINALITY AS w(val, pos)
    WHERE tcw.writers IS NOT NULL
) AS combined
JOIN category c ON c.name = combined.role
WHERE EXISTS (SELECT 1 FROM title_basic tb WHERE tb.tconst = combined.tconst)
  AND EXISTS (SELECT 1 FROM name_basics nb WHERE nb.nconst = combined.nconst)
  AND NOT EXISTS (
      SELECT 1 FROM raw_title_principals tp
      WHERE tp.tconst = combined.tconst
        AND tp.nconst = combined.nconst
        AND tp.category = combined.role
  );

-- 4i. title_character
INSERT INTO title_character (principalid, character)
SELECT DISTINCT
    newtp.principalid,
    trim(both '"' from ch.val) AS character
FROM raw_title_principals rtp
JOIN title_principals newtp
    ON newtp.tconst = rtp.tconst
   AND newtp.nconst = rtp.nconst
   AND newtp.is_crew = FALSE
   AND newtp.ordering = NULLIF(rtp.ordering::TEXT, '\N')::INTEGER
CROSS JOIN LATERAL unnest(
    string_to_array(trim(both '[]' from rtp.characters), ',')
) AS ch(val)
WHERE rtp.characters IS NOT NULL
  AND rtp.characters <> '\N'
  AND trim(both '"' from ch.val) <> '';

-- 4j. name_ratings (derived: weighted avg rating / total votes across a
--     person's titles, computed only after title_principals is populated)
INSERT INTO name_ratings (nconst, averagerating, agg_numvotes)
SELECT
    tp.nconst,
    ROUND(SUM(tr.averagerating * tr.numvotes) / NULLIF(SUM(tr.numvotes), 0), 1) AS averagerating,
    SUM(tr.numvotes) AS agg_numvotes
FROM title_principals tp
JOIN title_ratings tr ON tr.tconst = tp.tconst
GROUP BY tp.nconst;


--DROP TABLE IF EXISTS raw_title_basics CASCADE;
--DROP TABLE IF EXISTS raw_title_akas CASCADE;
--DROP TABLE IF EXISTS raw_title_principals CASCADE;
--DROP TABLE IF EXISTS raw_title_ratings CASCADE;
--DROP TABLE IF EXISTS raw_title_episode CASCADE;
--DROP TABLE IF EXISTS raw_title_crew CASCADE;
--DROP TABLE IF EXISTS raw_name_basics CASCADE;
--DROP TABLE IF EXISTS omdb_data CASCADE;