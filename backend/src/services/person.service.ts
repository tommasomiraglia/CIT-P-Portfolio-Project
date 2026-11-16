import { pool } from '../db/pool.js';
import { takePage } from '../lib/paging.js';
import { toPersonSummaryDto } from '../mappers/person.mapper.js';
import { searchPeopleByName } from '../repositories/person.repository.js';
import { saveSearch } from './search.history.service.js';
import type { PageRequest, PageSlice } from '../types/page.js';
import type { PersonSummaryDto } from '../types/person.js';


export async function searchPeople(
  query: string,
  pageRequest: PageRequest,
  userId?: number,
): Promise<PageSlice<PersonSummaryDto>> {
  if (userId !== undefined && pageRequest.page === 1) {
    await saveSearch(userId, query);
  }
  const rows = await searchPeopleByName(pool, query, pageRequest);
  return takePage(rows, pageRequest, toPersonSummaryDto);
}
