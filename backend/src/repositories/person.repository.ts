// Database access for names. Returns raw rows; mapping them to API objects is the mapper's job.

import { pool } from '../db/pool.js';
import type { Queryable } from '../db/transaction.js';
import { toLimitOffset } from '../lib/paging.js';
import type { PageRequest } from '../types/page.js';
import type {
  CoPlayerRow,
  PersonKnownForRow,
  PersonProfessionRow,
  PersonRow,
  PersonSearchRow,
  PersonWordRow,
} from '../types/person.js';

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

export async function findCoPlayers(
  db: Queryable,
  nconst: string,
  pageRequest: PageRequest,
): Promise<CoPlayerRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<CoPlayerRow>(
    'SELECT nconst, primaryname, freq::int AS freq FROM co_players($1, $2, $3)',
    [nconst, limit, offset],
  );
  return result.rows;
}
// The most frequent words in the titles of one person, most frequent first.
// freq is BIGINT, which pg returns as a string; ::int makes it a number.
export async function findPersonWords(
  db: Queryable,
  nconst: string,
  pageRequest: PageRequest,
): Promise<PersonWordRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<PersonWordRow>(
    'SELECT word, freq::int AS freq FROM person_words($1, $2, $3)',
    [nconst, limit, offset],
  );
  return result.rows;
}

const FIND_PERSON_BY_ID = `
  SELECT nb.nconst,
         nb.primaryname,
         nb.birthyear,
         nb.deathyear,
         nr.averagerating::float8 AS rating
  FROM name_basics nb
  LEFT JOIN name_ratings nr ON nr.nconst = nb.nconst
  WHERE nb.nconst = $1`;

export async function findPersonById(nconst: string): Promise<PersonRow | undefined> {
  const result = await pool.query<PersonRow>(FIND_PERSON_BY_ID, [nconst]);
  return result.rows[0];
}

const FIND_PROFESSIONS_BY_PERSON = `
  SELECT pp.name 
  FROM name_primaryprofession npp 
  JOIN primaryprofession pp 
  ON pp.professionid = npp.professionid 
  WHERE npp.nconst = $1 
  ORDER BY pp.name;
`;
export async function findProfessionsByPerson(nconst: string): Promise<PersonProfessionRow[]> {
  const result = await pool.query<PersonProfessionRow>(FIND_PROFESSIONS_BY_PERSON, [nconst]);
  return result.rows;
}

const FIND_KNOWN_FOR_BY_PERSON = `
  SELECT tb.tconst, tb.primarytitle 
  FROM knowfor kf JOIN title_basic tb 
  ON tb.tconst = kf.tconst 
  WHERE kf.nconst = $1
  ORDER BY tb.primarytitle, tb.tconst;
`;

export async function findKnownForByPerson(nconst: string): Promise<PersonKnownForRow[]> {
  const result = await pool.query<PersonKnownForRow>(FIND_KNOWN_FOR_BY_PERSON, [nconst]);
  return result.rows;
}
