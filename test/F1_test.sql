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
DROP TRIGGER IF EXISTS update_name_rating_trigger ON title_ratings;
DROP FUNCTION IF EXISTS update_name_ratings_after_rate();
DROP FUNCTION IF EXISTS string_search(INTEGER, TEXT);
DROP FUNCTION IF EXISTS rate(INTEGER, CHARACTER(10), INTEGER);
DROP FUNCTION IF EXISTS structured_string_search(INTEGER, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS search_names(INTEGER, TEXT);
DROP FUNCTION IF EXISTS co_players(VARCHAR);
DROP FUNCTION IF EXISTS popular_actors_in_movie(VARCHAR);
DROP FUNCTION IF EXISTS similarity_search(VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS search_by_exact_name(VARCHAR);
DROP FUNCTION IF EXISTS exact_match_search(TEXT[]);
DROP FUNCTION IF EXISTS any_match_search(TEXT[]);
DROP FUNCTION IF EXISTS words_query(TEXT[]);
DROP FUNCTION IF EXISTS weights_search(TEXT[]);
DROP TABLE IF EXISTS weights;


DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'wi' AND column_name = 'tconst') = 'character' THEN
        ALTER TABLE wi ALTER COLUMN tconst TYPE VARCHAR(10) USING trim(tconst);
    END IF;
END $$;


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


--D2

CREATE OR REPLACE FUNCTION string_search(p_userid INTEGER, p_query TEXT)
RETURNS TABLE(id VARCHAR(10), title TEXT) AS $$
BEGIN
INSERT INTO history(userid, value) VALUES (p_userid, p_query);
RETURN QUERY
SELECT tconst, primarytitle
FROM title_basic
WHERE
primarytitle LIKE '%' || p_query || '%'
OR
plot LIKE '%' || p_query || '%';
END;
$$ LANGUAGE plpgsql;



--D3

CREATE OR REPLACE FUNCTION rate(p_userid INTEGER, p_tconst CHARACTER(10), p_new_rating INTEGER)
RETURNS void AS $$
DECLARE
	old_value SMALLINT;
BEGIN
	IF EXISTS (SELECT 1 FROM rating_history WHERE userid = p_userid AND tconst = p_tconst) 
		THEN 
		SELECT value INTO old_value FROM rating_history WHERE userid = p_userid AND tconst = p_tconst;
		UPDATE title_ratings SET averagerating = (averagerating * numvotes - old_value + p_new_rating) / numvotes WHERE tconst = p_tconst;
		UPDATE rating_history SET value = p_new_rating WHERE userid = p_userid AND tconst = p_tconst;
	ELSE
		UPDATE title_ratings 
		SET averagerating = (averagerating * numvotes + p_new_rating) / (numvotes + 1), numvotes = numvotes + 1
		WHERE tconst = p_tconst;
		INSERT INTO rating_history(userid, tconst, value) VALUES (p_userid, p_tconst, p_new_rating);
	END IF;
END;
$$ LANGUAGE plpgsql;


--D4



CREATE OR REPLACE FUNCTION structured_string_search(
    p_userid INTEGER,
    p_title TEXT,
    p_plot TEXT,
    p_characters TEXT,
    p_names TEXT
)
RETURNS TABLE(id VARCHAR(10), title TEXT) AS $$
BEGIN
    IF p_title = '' AND p_plot = '' AND p_characters = '' AND p_names = '' THEN
        RETURN;
    END IF;

    INSERT INTO history(userid, value)
    VALUES (p_userid, 'title:' || p_title || ' plot:' || p_plot
                      || ' characters:' || p_characters || ' names:' || p_names);

    RETURN QUERY
    SELECT tb.tconst, tb.primarytitle
    FROM title_basic tb
    WHERE (p_title = '' OR tb.primarytitle ILIKE '%' || p_title || '%')
      AND (p_plot = ''  OR tb.plot ILIKE '%' || p_plot || '%')
      AND (p_names = '' OR EXISTS (
            SELECT 1
            FROM title_principals tp
            JOIN name_basics nb ON nb.nconst = tp.nconst
            WHERE tp.tconst = tb.tconst
              AND nb.primaryname ILIKE '%' || p_names || '%'))
      AND (p_characters = '' OR EXISTS (
            SELECT 1
            FROM title_principals tp
            JOIN title_character tc ON tc.principalid = tp.principalid
            WHERE tp.tconst = tb.tconst
              AND tc.character ILIKE '%' || p_characters || '%'));
END;
$$ LANGUAGE plpgsql;

--D5

CREATE OR REPLACE FUNCTION search_names(p_userid INTEGER, p_name TEXT)
RETURNS TABLE(nconst VARCHAR(10), name TEXT) AS $$
BEGIN
INSERT INTO history(userid, value) VALUES (p_userid, p_name);
RETURN QUERY
SELECT name_basics.nconst, primaryname FROM name_basics WHERE primaryname ILIKE '%' || p_name || '%';

END;
$$ LANGUAGE plpgsql;


--D6
CREATE OR REPLACE FUNCTION co_players(p_name VARCHAR)
RETURNS TABLE(nconst VARCHAR(10), name TEXT, freq BIGINT) AS $$
BEGIN
    RETURN QUERY
	SELECT n2.nconst, n2.primaryname, COUNT(DISTINCT tp1.tconst) AS freq
	FROM title_principals tp1
	JOIN title_principals tp2 ON tp1.tconst = tp2.tconst AND tp1.nconst <> tp2.nconst
	JOIN name_basics n1 ON tp1.nconst = n1.nconst
	JOIN name_basics n2 ON tp2.nconst = n2.nconst
	WHERE n1.primaryname = p_name
	GROUP BY n2.nconst, n2.primaryname
	ORDER BY freq DESC;
END;
$$ LANGUAGE plpgsql;

--D7

CREATE OR REPLACE FUNCTION update_name_ratings_after_rate()
RETURNS TRIGGER AS $$
BEGIN
	UPDATE name_ratings nr
SET averagerating = (
    SELECT ROUND(SUM(tr.averagerating * tr.numvotes) / NULLIF(SUM(tr.numvotes), 0), 1)
    FROM title_principals tp
    JOIN title_ratings tr ON tr.tconst = tp.tconst
    WHERE tp.nconst = nr.nconst
),
agg_numvotes = (
    SELECT SUM(tr.numvotes)
    FROM title_principals tp
    JOIN title_ratings tr ON tr.tconst = tp.tconst
    WHERE tp.nconst = nr.nconst
)
WHERE nr.nconst IN (
    SELECT nconst FROM title_principals WHERE tconst = NEW.tconst
);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER update_name_rating_trigger
AFTER UPDATE ON title_ratings
FOR EACH ROW
EXECUTE FUNCTION update_name_ratings_after_rate();

--D8

CREATE OR REPLACE FUNCTION popular_actors_in_movie(p_tconst VARCHAR)
RETURNS TABLE(nconst VARCHAR(10), name TEXT, rating NUMERIC, votes INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT nb.nconst, nb.primaryname, nr.averagerating, nr.agg_numvotes
    FROM (SELECT DISTINCT tp.nconst
          FROM title_principals tp
          JOIN category c ON c.categoryid = tp.categoryid
          WHERE tp.tconst = p_tconst AND c.name IN ('actor', 'actress')) a
    JOIN name_ratings nr ON nr.nconst = a.nconst
    JOIN name_basics nb  ON nb.nconst = a.nconst
    ORDER BY nr.averagerating DESC, nr.agg_numvotes DESC, nb.primaryname;
END;
$$ LANGUAGE plpgsql;

--D9

CREATE OR REPLACE FUNCTION similarity_search(p_tconst VARCHAR, p_limit INTEGER)
RETURNS TABLE(primarytitle TEXT, tconst VARCHAR(10), freq BIGINT) AS $$
BEGIN
    RETURN QUERY
	SELECT tb.primarytitle, tp2.tconst, COUNT(*) AS freq
	FROM generes_title_basic tp1
	JOIN generes_title_basic tp2
	ON tp1.genereid = tp2.genereid AND tp1.tconst <> tp2.tconst
	JOIN title_basic tb 
	ON tp2.tconst = tb.tconst
	WHERE tp1.tconst = p_tconst
	GROUP BY tp2.tconst, tb.primarytitle
	ORDER BY freq DESC
	LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

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
RETURNS TABLE(tconst VARCHAR(10)) AS $$
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
RETURNS TABLE(tconst VARCHAR(10), rank BIGINT) AS $$
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
RETURNS TABLE(tconst VARCHAR(10), rank NUMERIC) AS $$
BEGIN
  RETURN QUERY
    SELECT weights.tconst, SUM(weights.weight)::NUMERIC AS rank
    FROM weights
    WHERE weights.word = ANY(p_words)
    GROUP BY weights.tconst
    ORDER BY rank DESC;

END;
$$ LANGUAGE plpgsql;