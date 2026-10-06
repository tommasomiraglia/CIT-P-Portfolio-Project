# CIT/P Portfolio Project

Movie Data Model and Framework Model in PostgreSQL.
The database is also available on cit.ruc.dk in the database `cit16`.

## Requirements

The build starts from a database that already contains the content of
`imdb.backup`, `omdb_data.backup` and `wi.backup` (these files are not included).

## Build order

The order matters, because each script uses tables from the previous one:

1. `B2_build_movie_db.sql` (renames the raw tables, builds the new schema, drops the raw tables)
2. `C2_build_framework_db.sql` (refers to tables created by B2)
3. `D1_functionality.sql` (uses the table `wi` from `wi.backup`)
4. `D2_indexes.sql`
5. `test_script.sql`

## Commands

```powershell
psql -h localhost -U userName -d databaseName -f .\database\imdb.backup
psql -h localhost -U userName -d databaseName -f .\database\omdb_data.backup
psql -h localhost -U userName -d databaseName -f .\database\wi.backup
psql -h localhost -U userName -d databaseName -f .\database\B2_build_movie_db.sql
psql -h localhost -U userName -d databaseName -f .\database\C2_build_framework_db.sql
psql -h localhost -U userName -d databaseName -f .\database\D1_functionality.sql
psql -h localhost -U userName -d databaseName -f .\database\D2_indexes.sql
psql -h localhost -U userName -d databaseName -f test.sql > test_output.txt
```

## Notes

- B2 must be run on a freshly loaded database. It renames the source tables
  and drops them at the end, so it cannot be run twice on the same database.
- The test script calls the functions of D1 and therefore writes some rows
  (users, history, ratings, bookmarks) to the database.
- `D1_functionality.sql` creates the table `weights` from `wi`, which can take
  some time.