DROP FUNCTION IF EXISTS create_user(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS delete_user(INTEGER);
DROP FUNCTION IF EXISTS bookmark_title(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS remove_bookmark_title(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS bookmark_person(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS remove_bookmark_person(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS get_bookmarked_titles(INTEGER);
DROP FUNCTION IF EXISTS get_bookmarked_persons(INTEGER);
DROP FUNCTION IF EXISTS get_search_history(INTEGER);
DROP FUNCTION IF EXISTS get_rating_history(INTEGER);
DROP FUNCTION IF EXISTS search_by_exact_name(VARCHAR);
DROP FUNCTION IF EXISTS exact_match_search(TEXT[]);
DROP FUNCTION IF EXISTS any_match_search(TEXT[]);
DROP FUNCTION IF EXISTS words_query(TEXT[]);
DROP FUNCTION IF EXISTS weights_search(TEXT[]);
DROP TABLE IF EXISTS weights;

-- D.1 Basic framework functionality
--User management
CREATE OR REPLACE FUNCTION create_user(
    p_username    TEXT,
    p_email       TEXT,
    p_password    TEXT,
    p_phonenumber TEXT DEFAULT NULL,
    p_langid      INTEGER DEFAULT NULL,
    p_regionid    INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_userid INTEGER;
BEGIN
    INSERT INTO app_user (username, email, password, phonenumber, langid, regionid)
    VALUES (p_username, p_email, p_password, p_phonenumber, p_langid, p_regionid)
    RETURNING userid INTO v_userid;

    RETURN v_userid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_user(p_userid INTEGER)
RETURNS VOID AS $$
BEGIN
    DELETE FROM app_user WHERE userid = p_userid;
END;
$$ LANGUAGE plpgsql;

--Bookmarking
CREATE OR REPLACE FUNCTION bookmark_title(p_userid INTEGER, p_tconst VARCHAR(10))
RETURNS VOID AS $$
BEGIN
    INSERT INTO bookmarking_title (userid, tconst)
    VALUES (p_userid, p_tconst)
    ON CONFLICT (userid, tconst) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_bookmark_title(p_userid INTEGER, p_tconst VARCHAR(10))
RETURNS VOID AS $$
BEGIN
    DELETE FROM bookmarking_title
    WHERE userid = p_userid AND tconst = p_tconst;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bookmark_person(p_userid INTEGER, p_nconst VARCHAR(10))
RETURNS VOID AS $$
BEGIN
    INSERT INTO bookmarking_person (userid, nconst)
    VALUES (p_userid, p_nconst)
    ON CONFLICT (userid, nconst) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_bookmark_person(p_userid INTEGER, p_nconst VARCHAR(10))
RETURNS VOID AS $$
BEGIN
    DELETE FROM bookmarking_person
    WHERE userid = p_userid AND nconst = p_nconst;
END;
$$ LANGUAGE plpgsql;

--Retrieval
CREATE OR REPLACE FUNCTION get_bookmarked_titles(p_userid INTEGER)
RETURNS TABLE(tconst VARCHAR(10), primarytitle TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT tb.tconst, tb.primarytitle
        FROM bookmarking_title bt
        JOIN title_basic tb ON tb.tconst = bt.tconst
        WHERE bt.userid = p_userid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_bookmarked_persons(p_userid INTEGER)
RETURNS TABLE(nconst VARCHAR(10), primaryname TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT nb.nconst, nb.primaryname
        FROM bookmarking_person bp
        JOIN name_basics nb ON nb.nconst = bp.nconst
        WHERE bp.userid = p_userid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_search_history(p_userid INTEGER)
RETURNS TABLE("time" TIMESTAMP, value TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT h.time, h.value
        FROM history h
        WHERE h.userid = p_userid
        ORDER BY h.time DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_rating_history(p_userid INTEGER)
RETURNS TABLE(tconst VARCHAR(10), primarytitle TEXT, value SMALLINT, "comment" TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT rh.tconst, tb.primarytitle, rh.value, rh.comment
        FROM rating_history rh
        JOIN title_basic tb ON tb.tconst = rh.tconst
        WHERE rh.userid = p_userid;
END;
$$ LANGUAGE plpgsql;


-- D.2 Simple search

-- D.3 Rating

-- D.4 Structured search

-- D.5 Finding names

-- D.6 Co-players

-- D.7 Name rating (dynamic)

-- D.8 Popular actors

-- D.9 Similar movies

-- D.10–14 IR functions 
CREATE OR REPLACE FUNCTION search_by_exact_name(p_name VARCHAR)
RETURNS TABLE(a_word TEXT, number BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT wi.word, COUNT(*) AS number
    FROM wi 
    WHERE wi.tconst
    IN (SELECT tconst FROM name_basics NATURAL JOIN title_principals WHERE primaryname = p_name) 
    GROUP BY wi.word 
    ORDER BY number DESC 
    limit 5;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION exact_match_search(p_words TEXT[])
RETURNS TABLE(tconst CHARACTER(10)) AS $$
BEGIN
  RETURN QUERY
    SELECT wi.tconst
    FROM wi
    WHERE wi.word = ANY(p_words)
    GROUP BY wi.tconst
    HAVING COUNT(DISTINCT wi.word) = array_length(p_words, 1);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION any_match_search(p_words TEXT[])
RETURNS TABLE(tconst CHARACTER(10), rank BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT wi.tconst, COUNT(DISTINCT wi.word) AS rank
    FROM wi
    WHERE wi.word = ANY(p_words)
    GROUP BY wi.tconst
    ORDER BY rank DESC;

END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION words_query(p_words TEXT[])
RETURNS TABLE(a_word TEXT, number BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT wi.word, COUNT(*) AS number
    FROM wi 
    WHERE wi.tconst
    IN (SELECT wi.tconst FROM wi WHERE wi.word = ANY(p_words))
    GROUP BY wi.word 
    ORDER BY number DESC 
    limit 5;
END;
$$ LANGUAGE plpgsql;

create table weights as
  SELECT 
    tf.tconst, 
    tf.word, 
    tf.tf_count * ln(180893::FLOAT / df.df_count) AS weight
    FROM 
    (SELECT wi.tconst, wi.word, COUNT(*) AS tf_count FROM wi GROUP BY wi.tconst, wi.word)  AS tf
    JOIN 
    (SELECT word, COUNT(DISTINCT wi.tconst) AS df_count FROM wi GROUP BY wi.word) AS df
    ON tf.word = df.word;

CREATE OR REPLACE FUNCTION weights_search(p_words TEXT[])
RETURNS TABLE(tconst CHARACTER(10), rank NUMERIC) AS $$
BEGIN
  RETURN QUERY
    SELECT weights.tconst, SUM(weights.weight)::NUMERIC AS rank
    FROM weights
    WHERE weights.word = ANY(p_words)
    GROUP BY weights.tconst
    ORDER BY rank DESC;

END;
$$ LANGUAGE plpgsql;