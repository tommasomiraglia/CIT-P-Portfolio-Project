// Database access for titles. Returns raw rows; mapping them to API objects is the mapper's job.
import { pool } from '../db/pool.js';
import type { Queryable } from '../db/transaction.js';
import { toLimitOffset } from '../lib/paging.js';
import type { PageRequest } from '../types/page.js';
import type { PopularActorRow } from '../types/person.js';
import type {
  RankedTitleRow,
  SimilarTitleRow,
  TitleFieldSearch,
  TitleRow,
  TitleSearchRow,
} from '../types/title.js';

// $1 is a placeholder: pg sends the id separately from the SQL text,
// so a malicious id can never change the query (no SQL injection).
// One query for the whole title: the rating is at most one row (LEFT JOIN, so an unrated
// title still comes back), and ARRAY(...) folds the genres into one column, which is an
// empty array, not NULL, when the title has none.
// pg returns NUMERIC as a string so that no digits are lost; NUMERIC(5,1) fits a float8
// exactly enough, so ::float8 makes it a JSON number, as findPersonById does.
const FIND_TITLE_BY_ID = `
  SELECT tb.tconst,
         tb.primarytitle,
         tbt.name AS titletype,
         tb.isadult,
         tb.startyear,
         tb.endyear,
         tb.runtimeminutes,
         tb.plot,
         tb.poster_link,
         tr.averagerating::float8 AS averagerating,
         tr.numvotes,
         ARRAY(
           SELECT g.name
           FROM generes_title_basic gtb
           JOIN generes g ON g.genereid = gtb.genereid
           WHERE gtb.tconst = tb.tconst
           ORDER BY g.name
         ) AS genres
  FROM title_basic tb
  LEFT JOIN title_basic_type tbt ON tbt.titletypeid = tb.titletypeid
  LEFT JOIN title_ratings tr ON tr.tconst = tb.tconst
  WHERE tb.tconst = $1`;

export async function findTitleById(tconst: string): Promise<TitleRow | undefined> {
  const result = await pool.query<TitleRow>(FIND_TITLE_BY_ID, [tconst]);
  return result.rows[0];
}

// Titles whose title or plot contains `query`. Fetches one row more than the page holds,
// so the service can tell whether there is a next page (docs/api-design.md 3.3).
export async function searchTitlesByText(
  db: Queryable,
  query: string,
  pageRequest: PageRequest,
): Promise<TitleSearchRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<TitleSearchRow>(
    'SELECT tconst, primarytitle FROM string_search($1, $2, $3)',
    [query, limit, offset],
  );
  return result.rows;
}

// Titles that match every given field: title and plot by their text, characters and names
// through the people of the title. A null field is not filtered on.
export async function searchTitlesByFields(
  db: Queryable,
  fields: TitleFieldSearch,
  pageRequest: PageRequest,
): Promise<TitleSearchRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<TitleSearchRow>(
    'SELECT tconst, primarytitle FROM structured_string_search($1, $2, $3, $4, $5, $6)',
    [fields.title, fields.plot, fields.characters, fields.names, limit, offset],
  );
  return result.rows;
}

// The three word searches look the words up in the word index (table wi, and weights for
// the ranked one) instead of scanning titles and plots. pg sends a JavaScript array as a
// PostgreSQL array; ::text[] states its type.

// Titles that contain every one of the words, ordered by title.
export async function findTitlesWithAllWords(
  db: Queryable,
  words: string[],
  pageRequest: PageRequest,
): Promise<TitleSearchRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<TitleSearchRow>(
    'SELECT tconst, primarytitle FROM exact_match_search($1::text[], $2, $3)',
    [words, limit, offset],
  );
  return result.rows;
}

// Titles that contain at least one of the words, those with the most words first.
// rank is BIGINT, which pg returns as a string; ::int makes it a number.
export async function findTitlesWithAnyWord(
  db: Queryable,
  words: string[],
  pageRequest: PageRequest,
): Promise<RankedTitleRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<RankedTitleRow>(
    'SELECT tconst, primarytitle, rank::int AS rank FROM any_match_search($1::text[], $2, $3)',
    [words, limit, offset],
  );
  return result.rows;
}

// Titles that contain at least one of the words, ordered by the summed weight of those
// words: a word counts for more when it is frequent in the title and rare in the index.
// rank is NUMERIC, which pg returns as a string; ::float8 makes it a number.
export async function findTitlesRankedByWords(
  db: Queryable,
  words: string[],
  pageRequest: PageRequest,
): Promise<RankedTitleRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<RankedTitleRow>(
    'SELECT tconst, primarytitle, rank::float8 AS rank FROM weights_search($1::text[], $2, $3)',
    [words, limit, offset],
  );
  return result.rows;
}

export async function findSimilarTitles(
  db: Queryable,
  tconst: string,
  pageRequest: PageRequest,
): Promise<SimilarTitleRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<SimilarTitleRow>(
    'SELECT tconst, primarytitle, freq::int AS freq FROM similarity_search($1, $2, $3)',
    [tconst, limit, offset],
  );
  return result.rows;
}

export async function findPopularActors(
  db: Queryable,
  tconst: string,
  pageRequest: PageRequest,
): Promise<PopularActorRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<PopularActorRow>(
    'SELECT nconst, primaryname, rating::float8 AS rating, votes FROM popular_actors_in_movie($1, $2, $3)',
    [tconst, limit, offset],
  );
  return result.rows;
}
