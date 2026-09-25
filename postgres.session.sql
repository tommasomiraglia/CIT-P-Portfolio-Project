SELECT COUNT(*) AS gruppi_con_ordering_duplicato
FROM (
    SELECT tconst, ordering
    FROM title_principals
    WHERE ordering IS NOT NULL
    GROUP BY tconst, ordering
    HAVING COUNT(*) > 1
) AS duplicati;