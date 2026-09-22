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