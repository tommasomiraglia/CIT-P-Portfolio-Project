-- F1: tests of the functions in D1_functionality.sql.
-- Run it after B2, C2, D1 and D2 (see README.md).
-- Everything runs in one transaction that is rolled back at the end, so the script leaves no rows behind.
-- The comment after each call says what the result should be.
-- The DO blocks check a result themselves and stop the script with "FAIL: ..." when it is wrong.

\set ON_ERROR_STOP on
\pset footer off

BEGIN;

------------------------------------------------------------------
-- D1: users
------------------------------------------------------------------

SELECT create_user('f1_test_user', 'f1_test@example.com', 'secret') AS userid \gset

SELECT * FROM get_user(:userid);                                   -- one row, no password column
SELECT update_user(:userid, p_phonenumber => '12345678') AS updated;  -- t
SELECT * FROM get_user(:userid);                                   -- phonenumber 12345678, the rest unchanged
SELECT update_user(-1, 'nobody') AS updated_missing_user;          -- f

------------------------------------------------------------------
-- D1: bookmarks
------------------------------------------------------------------

SELECT bookmark_title(:userid, 'tt0468569') AS created;            -- t
SELECT bookmark_title(:userid, 'tt0468569') AS created_again;      -- f (already there)
SELECT bookmark_title(:userid, 'tt1375666') AS created;            -- t
SELECT * FROM get_bookmarked_titles(:userid, 10, 0);               -- Inception, The Dark Knight
SELECT * FROM get_bookmarked_titles(:userid, 1, 1);                -- The Dark Knight only (second page of size 1)
SELECT remove_bookmark_title(:userid, 'tt0468569') AS deleted;     -- t
SELECT remove_bookmark_title(:userid, 'tt0468569') AS deleted_again; -- f (not found)

SELECT bookmark_person(:userid, 'nm0586568') AS created;           -- t
SELECT bookmark_person(:userid, 'nm0586568') AS created_again;     -- f
SELECT * FROM get_bookmarked_persons(:userid, 10, 0);              -- Mads Mikkelsen
SELECT remove_bookmark_person(:userid, 'nm0586568') AS deleted;    -- t

------------------------------------------------------------------
-- D1: genre preferences
------------------------------------------------------------------

SELECT add_genre_preference(:userid, 3) AS created;                -- t
SELECT add_genre_preference(:userid, 3) AS created_again;          -- f
SELECT * FROM get_genre_preferences(:userid, 10, 0);               -- Horror
SELECT remove_genre_preference(:userid, 3) AS deleted;             -- t

------------------------------------------------------------------
-- D1: search history
------------------------------------------------------------------

SELECT add_search_history(:userid, 'Dark Knight') AS historyid \gset
SELECT add_search_history(:userid, 'Mikkelsen') AS second_historyid;
SELECT * FROM get_search_history(:userid, 10, 0);                  -- Mikkelsen first, then Dark Knight
SELECT delete_search_history_entry(:userid, :historyid) AS deleted;       -- t
SELECT delete_search_history_entry(:userid, :historyid) AS deleted_again; -- f
SELECT clear_search_history(:userid) AS removed_entries;           -- 1

------------------------------------------------------------------
-- D2, D4, D5: searches (they no longer write to history)
------------------------------------------------------------------

SELECT * FROM string_search('Dark Knight', 5, 0);                  -- titles containing "Dark Knight"
SELECT * FROM structured_string_search('Dark Knight', '', '', 'Ledger', 5, 0);  -- title AND name must match
SELECT count(*) AS all_fields_empty
FROM structured_string_search('', '', '', '', 5, 0);               -- 0
SELECT * FROM search_names('Mads Mikkelsen', 5, 0);                -- Mads Mikkelsen

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM history
               WHERE userid = (SELECT userid FROM app_user WHERE username = 'f1_test_user')) THEN
        RAISE EXCEPTION 'FAIL: a search function wrote to history';
    END IF;
    RAISE NOTICE 'OK: searches did not write to history';
END $$;

------------------------------------------------------------------
-- D3: rating
------------------------------------------------------------------

SELECT averagerating, numvotes FROM title_ratings WHERE tconst = 'tt1375666';  -- before
SELECT rate(:userid, 'tt1375666', 10);
SELECT averagerating, numvotes FROM title_ratings WHERE tconst = 'tt1375666';  -- numvotes + 1
SELECT rate(:userid, 'tt1375666', 2);
SELECT averagerating, numvotes FROM title_ratings WHERE tconst = 'tt1375666';  -- same numvotes, new value counted
SELECT set_rating_comment(:userid, 'tt1375666', 'Changed my mind') AS updated;  -- t
SELECT * FROM get_rating_history(:userid, 10, 0);                  -- Inception, 2, 'Changed my mind'

DO $$
BEGIN
    PERFORM rate((SELECT userid FROM app_user WHERE username = 'f1_test_user'), 'tt1375666', 11);
    RAISE EXCEPTION 'FAIL: rate accepted 11';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL%' THEN
        RAISE;
    END IF;
    RAISE NOTICE 'OK: rate rejected 11 (%)', SQLERRM;
END $$;

SELECT unrate(:userid, 'tt1375666') AS deleted;                    -- t
SELECT unrate(:userid, 'tt1375666') AS deleted_again;              -- f
SELECT averagerating, numvotes FROM title_ratings WHERE tconst = 'tt1375666';  -- back to the first values

------------------------------------------------------------------
-- D3 + D7: first vote on an unrated title, then removing it again.
-- tt0236605 (Planet Earth: Episode 10) has no row in title_ratings.
-- After each step, every person in it must have the name rating that
-- the B2 formula gives (each title counted once per person).
------------------------------------------------------------------

CREATE TEMP VIEW name_rating_check AS
SELECT p.nconst,
       nr.averagerating,
       nr.agg_numvotes,
       e.averagerating AS expected_rating,
       e.agg_numvotes  AS expected_votes,
       nr.averagerating IS NOT DISTINCT FROM e.averagerating
         AND nr.agg_numvotes IS NOT DISTINCT FROM e.agg_numvotes AS ok
FROM (SELECT DISTINCT nconst FROM title_principals WHERE tconst = 'tt0236605') AS p
LEFT JOIN name_ratings nr ON nr.nconst = p.nconst
LEFT JOIN (SELECT d.nconst,
                  ROUND(SUM(tr.averagerating * tr.numvotes) / NULLIF(SUM(tr.numvotes), 0), 1) AS averagerating,
                  SUM(tr.numvotes) AS agg_numvotes
           FROM (SELECT DISTINCT tconst, nconst FROM title_principals) AS d
           JOIN title_ratings tr ON tr.tconst = d.tconst
           GROUP BY d.nconst) AS e ON e.nconst = p.nconst;

SELECT rate(:userid, 'tt0236605', 7);
SELECT averagerating, numvotes FROM title_ratings WHERE tconst = 'tt0236605';  -- 7.0, 1
SELECT * FROM name_rating_check;                                   -- ok = t on every row

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM name_rating_check WHERE NOT ok) THEN
        RAISE EXCEPTION 'FAIL: name_ratings wrong after the first vote on a title';
    END IF;
    RAISE NOTICE 'OK: name_ratings updated after the first vote';
END $$;

SELECT unrate(:userid, 'tt0236605') AS deleted;                    -- t
SELECT count(*) AS title_rating_rows FROM title_ratings WHERE tconst = 'tt0236605';  -- 0
SELECT * FROM name_rating_check;                                   -- ok = t on every row

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM name_rating_check WHERE NOT ok) THEN
        RAISE EXCEPTION 'FAIL: name_ratings still count a title whose last vote was removed';
    END IF;
    RAISE NOTICE 'OK: name_ratings updated after the last vote was removed';
END $$;

------------------------------------------------------------------
-- D6, D8, D9
------------------------------------------------------------------

SELECT * FROM co_players('nm0586568', 5, 0);                       -- actors who played most often with Mads Mikkelsen
SELECT * FROM popular_actors_in_movie('tt0468569', 5, 0);          -- actors of The Dark Knight by name rating
SELECT * FROM similarity_search('tt0468569', 5, 0);                -- movies sharing most genres with The Dark Knight

------------------------------------------------------------------
-- D10-D14: word index
------------------------------------------------------------------

SELECT * FROM person_words('nm0586568');                           -- 10 most frequent words in his titles
SELECT * FROM exact_match_search(ARRAY['dog', 'cat'], 5, 0);       -- titles with both words
SELECT * FROM exact_match_search(ARRAY['apple', 'apple'], 5, 0);   -- same as searching 'apple' once, not empty
SELECT * FROM any_match_search(ARRAY['dog', 'cat'], 5, 0);         -- titles with either word, rank 2 (both) first
SELECT * FROM words_query(ARRAY['apple']);                         -- 10 words, 'apple' not among them
SELECT * FROM weights_search(ARRAY['apple', 'dog'], 5, 0);         -- titles ranked by summed weight

------------------------------------------------------------------
-- D1: deleting the user
------------------------------------------------------------------

SELECT delete_user(:userid) AS deleted;                            -- t
SELECT delete_user(:userid) AS deleted_again;                      -- f

ROLLBACK;
