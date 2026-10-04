-- Relevant for finding all bookmarks by a user
Create index Idx_usersBookmarkedTitles on bookmarking_title (userid)
create index Idx_usersBookmarkedPersion on bookmarking_person (userid)

-- We could make index on search history like this
--Create index Idx_usersHistury on history (userid)
-- But it would slow down write
-- since history will be written to more than it will be searched it should probably remain unindexed
-- Note that this dependes on how chaching is handled

-- relevant for finging rating history
Create index Idx_usersRatingHistory on rating_history (userid)

-- i dont think indexing helps on part of searches like D2

--Relevant for D4
Create index Idx_personName on name_basics (primaryname);

--Indexes to make joins more efficient 
Create index Idx_nameOfPrincipal on title_principals (nconst)
Create index Idx_titleOfPrincipal on title_principals (tconst)
Create index Idx_titleAkasForTitle on title_akas (titleid)
Create index Idx_EpisodesParrent on title_episodes (parentTconst)
