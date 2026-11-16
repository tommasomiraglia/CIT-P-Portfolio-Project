// Database access for names. Returns raw rows; mapping them to API objects is the mapper's job.


import type { Queryable } from '../db/transaction.js';
import { toLimitOffset } from '../lib/paging.js';
import type { PageRequest } from '../types/page.js';
import type { PersonSearchRow } from '../types/person.js';


export async function searchPeopleByName(
  db: Queryable,
  name: string,
  pageRequest: PageRequest,
): Promise<PersonSearchRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<PersonSearchRow>(
    'SELECT nconst, primaryname FROM search_names($1, $2, $3)',
    [name, limit, offset],
  );
  return result.rows;
}
