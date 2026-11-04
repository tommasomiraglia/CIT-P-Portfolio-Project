

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_name_primaryname_trgm  ON name_basics USING gin (primaryname gin_trgm_ops);
CREATE INDEX idx_title_primarytitle_trgm ON title_basic USING gin (primarytitle gin_trgm_ops);

--Indexes to make joins more efficient 
Create index Idx_nameOfPrincipal on title_principals (nconst);
Create index Idx_titleOfPrincipal on title_principals (tconst);
Create index Idx_titleAkasForTitle on title_akas (titleid);
Create index Idx_EpisodesParent on title_episode (parentconst);

-- Lookups where the PK starts with the other column
Create index Idx_knowforPerson on knowfor (nconst);
Create index Idx_genreTitles on generes_title_basic (genereid);

-- History for one user
CREATE index Idx_history_user_time ON history (userid, time DESC);

-- IR functions 1.D.11-1.D.14 find the rows for the given words
CREATE INDEX idx_wi_word_tconst ON wi (word, tconst);
-- person_words and words_query read all words of a given set of titles
CREATE INDEX idx_wi_tconst ON wi (tconst);
-- weights_search reads the weight and title straight from the index
CREATE INDEX idx_weights_word ON weights (word) INCLUDE (tconst, weight);