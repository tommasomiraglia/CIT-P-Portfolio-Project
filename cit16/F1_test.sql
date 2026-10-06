\set ON_ERROR_STOP on
\pset pager off
\timing on

DELETE FROM app_user WHERE username = 'f_test_user';
SELECT averagerating AS orig_avg, numvotes AS orig_votes
FROM title_ratings WHERE tconst = 'tt10937852' \gset


-- 1-D.1 
SELECT create_user('f_test_user', 'f_test@example.com', 'pass') AS uid \gset
\echo Created user with id :uid

SELECT bookmark_title(:uid, 'tt0052520');
SELECT bookmark_title(:uid, 'tt10937852');
SELECT bookmark_person(:uid, (SELECT nconst FROM name_basics WHERE primaryname = 'Johnny Depp' LIMIT 1));

-- before 
SELECT * FROM get_bookmarked_titles(:uid);
SELECT * FROM get_bookmarked_persons(:uid);

SELECT remove_bookmark_title(:uid, 'tt10937852');

-- after removal
SELECT * FROM get_bookmarked_titles(:uid);

-- 1-D.2 
-- history before
SELECT * FROM get_search_history(:uid);
SELECT * FROM string_search(:uid, 'sword') LIMIT 5;
-- history after
SELECT * FROM get_search_history(:uid);


-- before
SELECT * FROM title_ratings WHERE tconst = 'tt10937852';
SELECT nconst, averagerating, agg_numvotes FROM name_ratings
WHERE nconst IN (SELECT nconst FROM title_principals WHERE tconst = 'tt10937852')
ORDER BY nconst;
SELECT rate(:uid, 'tt10937852', 10);

-- after 
SELECT * FROM title_ratings WHERE tconst = 'tt10937852';
SELECT nconst, averagerating, agg_numvotes FROM name_ratings
WHERE nconst IN (SELECT nconst FROM title_principals WHERE tconst = 'tt10937852')
ORDER BY nconst;

SELECT rate(:uid, 'tt10937852', 2);

SELECT * FROM title_ratings WHERE tconst = 'tt10937852';
SELECT * FROM get_rating_history(:uid);

-- 1-D.4 
SELECT * FROM structured_string_search(:uid, 'football', '', '', '') LIMIT 5;
SELECT * FROM structured_string_search(:uid, 'dragon', 'magic', '', '') LIMIT 5;

-- 1-D.5 
SELECT * FROM search_names(:uid, 'Depp') LIMIT 5;

-- 1-D.6 
SELECT * FROM co_players('Johnny Depp') LIMIT 5;


-- 1-D.8 

SELECT * FROM popular_actors_in_movie('tt0052520') LIMIT 10;


-- 1-D.9 
SELECT * FROM similarity_search('tt0052520', 5);


-- 1-D.10 
SELECT * FROM search_by_exact_name('Johnny Depp');


-- 1-D.11

SELECT * FROM exact_match_search(ARRAY['heist', 'car']);
SELECT * FROM any_match_search(ARRAY['heist', 'car']) LIMIT 10;


-- 1-D.13
SELECT * FROM words_query(ARRAY['love', 'arrow']);
SELECT * FROM weights_search(ARRAY['love', 'arrow']) LIMIT 10;


-- 1-D.1 
UPDATE title_ratings SET averagerating = :orig_avg, numvotes = :orig_votes
WHERE tconst = 'tt10937852';
SELECT * FROM title_ratings WHERE tconst = 'tt10937852';


SELECT delete_user(:uid);
SELECT count(*) AS history_rows_left FROM history WHERE userid = :uid;
SELECT count(*) AS ratings_rows_left FROM rating_history WHERE userid = :uid;
