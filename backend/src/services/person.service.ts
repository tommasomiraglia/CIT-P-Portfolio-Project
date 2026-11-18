// Business logic for people: fetches rows through the repository and returns API objects.

import { pool } from '../db/pool.js';
import { takePage } from '../lib/paging.js';
import {
  toCoPlayerDto,
  toPersonDto,
  toPersonSummaryDto,
  toPersonWordDto,
} from '../mappers/person.mapper.js';
import { NotFoundError } from '../middleware/errors.js';
import {
  findCoPlayers,
  findKnownForByPerson,
  findPersonById,
  findPersonWords,
  findProfessionsByPerson,
  searchPeopleByName,
} from '../repositories/person.repository.js';
import type { PageRequest, PageSlice } from '../types/page.js';
import type { CoPlayerDto, PersonDto, PersonSummaryDto, PersonWordDto } from '../types/person.js';
import { saveSearch } from './search.history.service.js';

// One person with professions and known-for titles. An unknown id is a 404 error
export async function getPerson(nconst: string): Promise<PersonDto> {
  const person = await findPersonById(nconst);
  if (!person) {
    throw new NotFoundError(`Person ${nconst} not found`);
  }
  const professions = await findProfessionsByPerson(nconst);
  const knownFor = await findKnownForByPerson(nconst);
  return toPersonDto(person, professions, knownFor);
}

// Same rules as searchTitles: a logged-in search is saved to history on page 1 only
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

// Actors who worked with the person most often, paged. An unknown person is a 404,
// a person without co-players is an empty page.
export async function getCoPlayers(
  nconst: string,
  pageRequest: PageRequest,
): Promise<PageSlice<CoPlayerDto>> {
  const person = await findPersonById(nconst);
  if (!person) {
    throw new NotFoundError(`Person ${nconst} not found`);
  }
  const rows = await findCoPlayers(pool, nconst, pageRequest);
  return takePage(rows, pageRequest, toCoPlayerDto);
}

// The most frequent words in the person's titles, paged. An unknown person is a 404.
export async function getPersonWords(
  nconst: string,
  pageRequest: PageRequest,
): Promise<PageSlice<PersonWordDto>> {
  const person = await findPersonById(nconst);
  if (!person) {
    throw new NotFoundError(`Person ${nconst} not found`);
  }
  const rows = await findPersonWords(pool, nconst, pageRequest);
  return takePage(rows, pageRequest, toPersonWordDto);
}
