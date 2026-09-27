DROP FUNCTION IF EXISTS search_by_exact_name(VARCHAR);
DROP FUNCTION IF EXISTS exact_match_search(TEXT[]);
DROP FUNCTION IF EXISTS any_match_search(TEXT[]);
DROP FUNCTION IF EXISTS words_query(TEXT[]);
DROP FUNCTION IF EXISTS weights_search(TEXT[]);
DROP TABLE IF EXISTS weights;

-- 1-D.1 Framework support (users, bookmarking, notes, history retrieval)

-- 1-D.2 Simple search

-- 1-D.3 Rating

-- 1-D.4 Structured search

-- 1-D.5 Finding names

-- 1-D.6 Co-players

-- 1-D.7 Name rating (dynamic)

-- 1-D.8 Popular actors

-- 1-D.9 Similar movies

-- 1-D.10–14 IR functions 
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