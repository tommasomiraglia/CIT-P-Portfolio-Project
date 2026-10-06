--Relevant for D4
Create index Idx_personName on name_basics (primaryname);

--Indexes to make joins more efficient 
Create index Idx_nameOfPrincipal on title_principals (nconst);
Create index Idx_titleOfPrincipal on title_principals (tconst);
Create index Idx_titleAkasForTitle on title_akas (titleid);
Create index Idx_EpisodesParent on title_episode (parentconst);

-- Lookups where the PK starts with the other column
Create index Idx_knowforPerson on knowfor (nconst);
Create index Idx_genreTitles on generes_title_basic (genereid);