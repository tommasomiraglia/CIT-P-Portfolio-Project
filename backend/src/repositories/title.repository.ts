// Database access for titles. Returns raw rows; mapping them to API objects is the mapper's job.
import { pool } from '../db/pool.js';
import type { Queryable } from '../db/transaction.js';
import { toLimitOffset } from '../lib/paging.js';
import type { PageRequest } from '../types/page.js';
import type { TitleRow, TitleSearchRow } from '../types/title.js';

// $1 is a placeholder: pg sends the id separately from the SQL text,
// so a malicious id can never change the query (no SQL injection).
const FIND_TITLE_BY_ID = `
  SELECT tb.tconst,
         tb.primarytitle,
         tbt.name AS titletype,
         tb.isadult,
         tb.startyear,
         tb.endyear,
         tb.runtimeminutes,
         tb.plot,
         tb.poster_link
  FROM title_basic tb
  LEFT JOIN title_basic_type tbt ON tbt.titletypeid = tb.titletypeid
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
