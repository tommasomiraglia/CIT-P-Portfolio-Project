// Database access for the word index. Returns raw rows; mapping them to API objects is
// the mapper's job.
import type { Queryable } from '../db/transaction.js';
import { toLimitOffset } from '../lib/paging.js';
import type { PageRequest } from '../types/page.js';
import type { WordRow } from '../types/word.js';

// The words that occur most often in the titles containing any of `words`, most frequent
// first, without the given words themselves. Fetches one row more than the page holds, so
// the service can tell whether there is a next page (docs/api-design.md 3.3).
// pg sends a JavaScript array as a PostgreSQL array; ::text[] states its type.
// freq is BIGINT, which pg returns as a string; ::int makes it a number.
export async function findRelatedWords(
  db: Queryable,
  words: string[],
  pageRequest: PageRequest,
): Promise<WordRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<WordRow>(
    'SELECT word, freq::int AS freq FROM words_query($1::text[], $2, $3)',
    [words, limit, offset],
  );
  return result.rows;
}
