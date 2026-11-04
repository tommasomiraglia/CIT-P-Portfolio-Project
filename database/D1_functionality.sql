--==========UPDATE==========
-- string_search, structured_string_search and search_names used to write to history by themselves.
-- Through the API that would record a search once per page, make searching impossible without a user,
-- and give a GET request a side effect. Now they only search: they take p_limit and p_offset,
-- order their results with tconst or nconst as a tiebreaker so pages are stable, and return tconst and primarytitle.
-- The backend records a search once, for a signed-in user, through the new add_search_history function.
-- structured_string_search now requires every given field to match (AND), as 1.D.4 describes,
-- and returns nothing when all four fields are empty.
-- co_players and search_by_exact_name found the person by name, which is not unique.
-- The API addresses a person by nconst, so both now take p_nconst.
-- search_by_exact_name is renamed person_words, the name used in 1.D.10; it takes a limit of 10
-- and counts only title and plot words.
-- co_players and popular_actors_in_movie consider only actor and actress roles and count each title or person once,
-- because title_principals repeats person+title pairs. popular_actors_in_movie also returns the number of votes
-- behind the rating. All three take p_limit and p_offset and order with a tiebreaker.
-- similarity_search, exact_match_search, any_match_search, words_query and weights_search now take p_limit and p_offset
-- and order with a tiebreaker, so every list can be paged for 2.A.3.
-- The three title searches return the title as well as the id, so a client can show a result list
-- without one request per title.
-- exact_match_search counts distinct query words, so a repeated word no longer gives an empty result.
-- similarity_search compares only titles of the same type and breaks ties by number of votes.
-- words_query counts only title and plot words, leaves out the query words, and takes a limit of 10.

-- get_user (without the password) and update_user (NULL leaves a field unchanged) complete create, read,
-- update and delete for users.
-- delete_user, the bookmark functions and their remove counterparts return true or false,
-- so the API can tell "created" from "already there" and "deleted" from "not found".
-- The four functions that list a user's bookmarks, search history and ratings take p_limit and p_offset
-- and order with a tiebreaker.
-- The name rating trigger also fires on DELETE, because unrate deletes the title_ratings row
-- when it removes a title's last vote.

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
DROP FUNCTION IF EXISTS rate(INTEGER, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS structured_string_search(INTEGER, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS search_names(INTEGER, TEXT);
DROP FUNCTION IF EXISTS string_search(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS structured_string_search(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS search_names(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS add_search_history(INTEGER, TEXT);
DROP FUNCTION IF EXISTS co_players(VARCHAR);
DROP FUNCTION IF EXISTS popular_actors_in_movie(VARCHAR);
DROP FUNCTION IF EXISTS similarity_search(VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS search_by_exact_name(VARCHAR);
DROP FUNCTION IF EXISTS co_players(VARCHAR, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS popular_actors_in_movie(VARCHAR, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS person_words(VARCHAR, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS exact_match_search(TEXT[]);
DROP FUNCTION IF EXISTS any_match_search(TEXT[]);
DROP FUNCTION IF EXISTS words_query(TEXT[]);
DROP FUNCTION IF EXISTS weights_search(TEXT[]);
DROP FUNCTION IF EXISTS similarity_search(VARCHAR, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS exact_match_search(TEXT[], INTEGER, INTEGER);
DROP FUNCTION IF EXISTS any_match_search(TEXT[], INTEGER, INTEGER);
DROP FUNCTION IF EXISTS words_query(TEXT[], INTEGER, INTEGER);
DROP FUNCTION IF EXISTS weights_search(TEXT[], INTEGER, INTEGER);
DROP TABLE IF EXISTS weights;
DROP FUNCTION IF EXISTS get_user(INTEGER);
DROP FUNCTION IF EXISTS update_user(INTEGER, TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_bookmarked_titles(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_bookmarked_persons(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_search_history(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_rating_history(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS unrate(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS set_rating_comment(INTEGER, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS delete_search_history_entry(INTEGER, BIGINT);
DROP FUNCTION IF EXISTS clear_search_history(INTEGER);
DROP FUNCTION IF EXISTS add_genre_preference(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS remove_genre_preference(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_genre_preferences(INTEGER, INTEGER, INTEGER);

-- Convert wi.tconst from char(10) to varchar(10) if it is not done yet
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'wi'
        AND column_name = 'tconst') = 'character' THEN
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

-- Returns false when there was no such user, so the API can answer 404.
CREATE OR REPLACE FUNCTION delete_user(p_userid INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM app_user WHERE userid = p_userid;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;


-- One user, without the password: it never leaves the database.
CREATE OR REPLACE FUNCTION get_user(p_userid INTEGER)
RETURNS TABLE(userid INTEGER, username TEXT, email TEXT,
              phonenumber TEXT, langid INTEGER, regionid INTEGER) AS $$
BEGIN
    RETURN QUERY
        SELECT u.userid, u.username, u.email, u.phonenumber, u.langid, u.regionid
        FROM app_user u
        WHERE u.userid = p_userid;
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION update_user(
    p_userid INTEGER,
    p_username TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phonenumber TEXT DEFAULT NULL,
    p_langid INTEGER DEFAULT NULL,
    p_regionid INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE app_user
    SET username = coalesce(p_username, username),
        email = coalesce(p_email, email),
        phonenumber = coalesce(p_phonenumber, phonenumber),
        langid = coalesce(p_langid, langid),
        regionid = coalesce(p_regionid, regionid)
    WHERE userid = p_userid;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;


--Bookmarking
CREATE OR REPLACE FUNCTION bookmark_title(p_userid INTEGER, p_tconst VARCHAR(10))
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO bookmarking_title (userid, tconst)
    VALUES (p_userid, p_tconst)
    ON CONFLICT (userid, tconst) DO NOTHING;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_bookmark_title(p_userid INTEGER, p_tconst VARCHAR(10))
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM bookmarking_title
    WHERE userid = p_userid AND tconst = p_tconst;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bookmark_person(p_userid INTEGER, p_nconst VARCHAR(10))
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO bookmarking_person (userid, nconst)
    VALUES (p_userid, p_nconst)
    ON CONFLICT (userid, nconst) DO NOTHING;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_bookmark_person(p_userid INTEGER, p_nconst VARCHAR(10))
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM bookmarking_person
    WHERE userid = p_userid AND nconst = p_nconst;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

--Retrieval


CREATE OR REPLACE FUNCTION get_bookmarked_titles(p_userid INTEGER, p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(tconst VARCHAR(10), primarytitle TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT tb.tconst, tb.primarytitle
        FROM bookmarking_title bt
        JOIN title_basic tb ON tb.tconst = bt.tconst
        WHERE bt.userid = p_userid
        ORDER BY tb.primarytitle, tb.tconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_bookmarked_persons(p_userid INTEGER, p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(nconst VARCHAR(10), primaryname TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT nb.nconst, nb.primaryname
        FROM bookmarking_person bp
        JOIN name_basics nb ON nb.nconst = bp.nconst
        WHERE bp.userid = p_userid
        ORDER BY nb.primaryname, nb.nconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION add_search_history(p_userid INTEGER, p_value TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_historyid BIGINT;
BEGIN
    INSERT INTO history (userid, value)
    VALUES (p_userid, p_value)
    RETURNING historyid INTO v_historyid;

    RETURN v_historyid;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION delete_search_history_entry(p_userid INTEGER, p_historyid BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM history
    WHERE historyid = p_historyid AND userid = p_userid;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Deletes a user's whole search history and returns how many entries it held.
CREATE OR REPLACE FUNCTION clear_search_history(p_userid INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM history WHERE userid = p_userid;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_search_history(p_userid INTEGER, p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(historyid BIGINT, "time" TIMESTAMP, value TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT h.historyid, h.time, h.value
        FROM history h
        WHERE h.userid = p_userid
        ORDER BY h.time DESC, h.historyid DESC
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION get_rating_history(p_userid INTEGER, p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(tconst VARCHAR(10), primarytitle TEXT, value SMALLINT, "comment" TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT rh.tconst, tb.primarytitle, rh.value, rh.comment
        FROM rating_history rh
        JOIN title_basic tb ON tb.tconst = rh.tconst
        WHERE rh.userid = p_userid
        ORDER BY tb.primarytitle, rh.tconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_genre_preference(p_userid INTEGER, p_genereid INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO generes_user (userid, genereid)
    VALUES (p_userid, p_genereid)
    ON CONFLICT (userid, genereid) DO NOTHING;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_genre_preference(p_userid INTEGER, p_genereid INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM generes_user
    WHERE userid = p_userid AND genereid = p_genereid;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_genre_preferences(p_userid INTEGER, p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(genereid INTEGER, name TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT g.genereid, g.name
        FROM generes_user gu
        JOIN generes g ON g.genereid = gu.genereid
        WHERE gu.userid = p_userid
        ORDER BY g.name, g.genereid
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;


--D2

CREATE OR REPLACE FUNCTION string_search(p_query TEXT, p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(tconst VARCHAR(10), primarytitle TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT tb.tconst, tb.primarytitle
        FROM title_basic tb
        WHERE tb.primarytitle LIKE '%' || p_query || '%'
           OR tb.plot         LIKE '%' || p_query || '%'
        ORDER BY tb.primarytitle, tb.tconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;



--D3

CREATE OR REPLACE FUNCTION rate(p_userid INTEGER, p_tconst VARCHAR(10), p_new_rating INTEGER)
RETURNS void AS $$
DECLARE
    old_value SMALLINT;
BEGIN
    IF p_new_rating NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION 'Rating must be 1-10, got %', p_new_rating;
    END IF;

    SELECT value INTO old_value
    FROM rating_history
    WHERE userid = p_userid AND tconst = p_tconst;

    IF FOUND THEN
        UPDATE title_ratings
        SET averagerating = (averagerating * numvotes - old_value + p_new_rating) / numvotes
        WHERE tconst = p_tconst;

        UPDATE rating_history
        SET value = p_new_rating
        WHERE userid = p_userid AND tconst = p_tconst;
    ELSE
        -- A new vote. The title may have no rating yet: then this is its first.
        INSERT INTO title_ratings (tconst, averagerating, numvotes)
        VALUES (p_tconst, p_new_rating, 1)
        ON CONFLICT (tconst) DO UPDATE
        SET averagerating = (title_ratings.averagerating * title_ratings.numvotes + p_new_rating)/ (title_ratings.numvotes + 1),
        numvotes = title_ratings.numvotes + 1;

        INSERT INTO rating_history (userid, tconst, value)
        VALUES (p_userid, p_tconst, p_new_rating);
    END IF;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION unrate(p_userid INTEGER, p_tconst VARCHAR(10))
RETURNS BOOLEAN AS $$
DECLARE
    old_value SMALLINT;
    v_votes   INTEGER;
BEGIN
    DELETE FROM rating_history
    WHERE userid = p_userid AND tconst = p_tconst
    RETURNING value INTO old_value;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    SELECT numvotes INTO v_votes FROM title_ratings WHERE tconst = p_tconst;

    IF v_votes > 1 THEN
        UPDATE title_ratings
        SET averagerating = (averagerating * numvotes - old_value) / (numvotes - 1),
            numvotes      = numvotes - 1
        WHERE tconst = p_tconst;
    ELSE
        DELETE FROM title_ratings WHERE tconst = p_tconst;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_rating_comment(p_userid INTEGER, p_tconst VARCHAR(10), p_comment TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE rating_history
    SET comment = p_comment
    WHERE userid = p_userid AND tconst = p_tconst;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;


--D4




CREATE OR REPLACE FUNCTION structured_string_search(
    p_title      TEXT,
    p_plot       TEXT,
    p_characters TEXT,
    p_names      TEXT,
    p_limit      INTEGER,
    p_offset     INTEGER
)
RETURNS TABLE(tconst VARCHAR(10), primarytitle TEXT) AS $$
BEGIN
    
    IF coalesce(p_title, '') = '' AND coalesce(p_plot, '') = ''
       AND coalesce(p_characters, '') = '' AND coalesce(p_names, '') = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
        SELECT tb.tconst, tb.primarytitle
        FROM title_basic tb
        WHERE (coalesce(p_title, '') = '' OR tb.primarytitle ILIKE '%' || p_title || '%')
          AND (coalesce(p_plot, '')  = '' OR tb.plot         ILIKE '%' || p_plot  || '%')
          AND (coalesce(p_names, '') = '' OR EXISTS (
                  SELECT 1
                  FROM title_principals tp
                  JOIN name_basics nb ON nb.nconst = tp.nconst
                  WHERE tp.tconst = tb.tconst
                    AND nb.primaryname ILIKE '%' || p_names || '%'))
          AND (coalesce(p_characters, '') = '' OR EXISTS (
                  SELECT 1
                  FROM title_principals tp
                  JOIN title_character tc ON tc.principalid = tp.principalid
                  WHERE tp.tconst = tb.tconst
                    AND tc.character ILIKE '%' || p_characters || '%'))
        ORDER BY tb.primarytitle, tb.tconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

--D5

CREATE OR REPLACE FUNCTION search_names(p_name TEXT, p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(nconst VARCHAR(10), primaryname TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT nb.nconst, nb.primaryname
        FROM name_basics nb
        WHERE nb.primaryname ILIKE '%' || p_name || '%'
        ORDER BY nb.primaryname, nb.nconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;


--D6
--The person is identified by nconst, because names are not unique.
CREATE OR REPLACE FUNCTION co_players(p_nconst VARCHAR(10), p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(nconst VARCHAR(10), primaryname TEXT, freq BIGINT) AS $$
BEGIN
    RETURN QUERY
        SELECT n2.nconst, n2.primaryname, COUNT(DISTINCT tp2.tconst) AS freq
        FROM title_principals tp1
        JOIN category c1 ON c1.categoryid = tp1.categoryid
        AND c1.name IN ('actor', 'actress')
        JOIN title_principals tp2 ON tp2.tconst = tp1.tconst
        AND tp2.nconst <> tp1.nconst
        JOIN category c2 ON c2.categoryid = tp2.categoryid
        AND c2.name IN ('actor', 'actress')
        JOIN name_basics n2 ON n2.nconst = tp2.nconst
        WHERE tp1.nconst = p_nconst
        GROUP BY n2.nconst, n2.primaryname
        ORDER BY freq DESC, n2.primaryname, n2.nconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

--D7

CREATE OR REPLACE FUNCTION update_name_ratings_after_rate()
RETURNS TRIGGER AS $$
DECLARE
    v_tconst VARCHAR(10);
BEGIN
    -- On DELETE there is no NEW row, only the OLD one.
    IF TG_OP = 'DELETE' THEN
        v_tconst := OLD.tconst;
    ELSE
        v_tconst := NEW.tconst;
    END IF;

    -- Recompute the rating of every person in the title that changed,
    -- counting each of their titles once (title_principals repeats pairs),
    -- and create the row when a person has none yet.
    INSERT INTO name_ratings (nconst, averagerating, agg_numvotes)
    SELECT p.nconst,
           ROUND(SUM(tr.averagerating * tr.numvotes) / NULLIF(SUM(tr.numvotes), 0), 1),
           SUM(tr.numvotes)
    FROM (SELECT DISTINCT tp.tconst, tp.nconst
          FROM title_principals tp
          WHERE tp.nconst IN (SELECT nconst FROM title_principals WHERE tconst = v_tconst)
         ) AS p
    JOIN title_ratings tr ON tr.tconst = p.tconst
    GROUP BY p.nconst
    ON CONFLICT (nconst) DO UPDATE
    SET averagerating = EXCLUDED.averagerating,
        agg_numvotes  = EXCLUDED.agg_numvotes;

    -- A person of this title with no rated title left has no name rating.
    DELETE FROM name_ratings nr
    WHERE nr.nconst IN (SELECT nconst FROM title_principals WHERE tconst = v_tconst)
      AND NOT EXISTS (SELECT 1
                      FROM title_principals tp
                      JOIN title_ratings tr ON tr.tconst = tp.tconst
                      WHERE tp.nconst = nr.nconst);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- DELETE is needed too: unrate deletes the title_ratings row when it removes the last vote.
CREATE TRIGGER update_name_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON title_ratings
FOR EACH ROW
EXECUTE FUNCTION update_name_ratings_after_rate();

--D8

CREATE OR REPLACE FUNCTION popular_actors_in_movie(p_tconst VARCHAR(10), p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(nconst VARCHAR(10), primaryname TEXT, rating NUMERIC, votes INTEGER) AS $$
BEGIN
    RETURN QUERY
        SELECT nb.nconst, nb.primaryname, nr.averagerating, nr.agg_numvotes
        FROM (SELECT DISTINCT tp.nconst
            FROM title_principals tp
            JOIN category c ON c.categoryid = tp.categoryid
            WHERE tp.tconst = p_tconst
            AND c.name IN ('actor', 'actress')
            )
         AS a
        JOIN name_ratings nr ON nr.nconst = a.nconst
        JOIN name_basics nb  ON nb.nconst = a.nconst
        ORDER BY nr.averagerating DESC, nr.agg_numvotes DESC, nb.nconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;


--D9

CREATE OR REPLACE FUNCTION similarity_search(p_tconst VARCHAR(10), p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(tconst VARCHAR(10), primarytitle TEXT, freq BIGINT) AS $$
BEGIN
    RETURN QUERY
        SELECT tb.tconst, tb.primarytitle, COUNT(*) AS freq
        FROM generes_title_basic g1
        JOIN generes_title_basic g2 ON g2.genereid = g1.genereid
        AND g2.tconst  <> g1.tconst
        JOIN title_basic tb ON tb.tconst = g2.tconst
        LEFT JOIN title_ratings tr ON tr.tconst = tb.tconst
        WHERE g1.tconst = p_tconst
          AND tb.titletypeid = (SELECT src.titletypeid
        FROM title_basic src
        WHERE src.tconst = p_tconst)
        GROUP BY tb.tconst, tb.primarytitle, tr.numvotes
        ORDER BY freq DESC, tr.numvotes DESC NULLS LAST, tb.tconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION person_words(
    p_nconst VARCHAR(10),
    p_limit  INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(word TEXT, freq BIGINT) AS $$
BEGIN
    RETURN QUERY
        SELECT wi.word, COUNT(*) AS freq
        FROM wi
        WHERE wi.field IN ('t', 'p')
          AND wi.tconst IN (SELECT tp.tconst
                            FROM title_principals tp
                            WHERE tp.nconst = p_nconst)
        GROUP BY wi.word
        ORDER BY freq DESC, wi.word
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION exact_match_search(p_words TEXT[], p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(tconst VARCHAR(10), primarytitle TEXT) AS $$
BEGIN
    RETURN QUERY
        SELECT tb.tconst, tb.primarytitle
        FROM (SELECT wi.tconst
            FROM wi
            WHERE wi.word = ANY(p_words)
            GROUP BY wi.tconst
            HAVING COUNT(DISTINCT wi.word) = (SELECT COUNT(DISTINCT w) FROM unnest(p_words) AS w)
             ) 
             AS m
        JOIN title_basic tb ON tb.tconst = m.tconst
        ORDER BY tb.primarytitle, tb.tconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION any_match_search(p_words TEXT[], p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(tconst VARCHAR(10), primarytitle TEXT, rank BIGINT) AS $$
BEGIN
    RETURN QUERY
        SELECT tb.tconst, tb.primarytitle, m.rank
        FROM (SELECT wi.tconst, COUNT(DISTINCT wi.word) AS rank
            FROM wi
            WHERE wi.word = ANY(p_words)
            GROUP BY wi.tconst
            )
              AS m
        JOIN title_basic tb ON tb.tconst = m.tconst
        ORDER BY m.rank DESC, tb.primarytitle, tb.tconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION words_query(
    p_words  TEXT[],
    p_limit  INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(word TEXT, freq BIGINT) AS $$
BEGIN
    RETURN QUERY
        SELECT wi.word, COUNT(*) AS freq
        FROM wi
        WHERE wi.field IN ('t', 'p')
        AND wi.word <> ALL(p_words)
         AND wi.tconst IN (SELECT m.tconst FROM wi m WHERE m.word = ANY(p_words))
        GROUP BY wi.word
        ORDER BY freq DESC, wi.word
        LIMIT p_limit OFFSET p_offset;
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

CREATE OR REPLACE FUNCTION weights_search(p_words TEXT[], p_limit INTEGER, p_offset INTEGER)
RETURNS TABLE(tconst VARCHAR(10), primarytitle TEXT, rank NUMERIC) AS $$
BEGIN
    RETURN QUERY
        SELECT tb.tconst, tb.primarytitle, m.rank
        FROM (SELECT w.tconst, SUM(w.weight)::NUMERIC AS rank
            FROM weights w
            WHERE w.word = ANY(p_words)
            GROUP BY w.tconst
             )
        AS m
        JOIN title_basic tb ON tb.tconst = m.tconst
        ORDER BY m.rank DESC, tb.tconst
        LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;