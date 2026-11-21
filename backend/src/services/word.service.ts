// Business logic for the word index: fetches rows through the repository and returns
// API objects.
import { pool } from '../db/pool.js';
import { takePage } from '../lib/paging.js';
import { toWordDto } from '../mappers/word.mapper.js';
import { findRelatedWords } from '../repositories/word.repository.js';
import type { PageRequest, PageSlice } from '../types/page.js';
import type { WordDto } from '../types/word.js';

// Words nobody indexed are not an error: they have no related words, which is an empty
// page, the same answer as a search that finds nothing.
export async function getRelatedWords(
  words: string[],
  pageRequest: PageRequest,
): Promise<PageSlice<WordDto>> {
  const rows = await findRelatedWords(pool, words, pageRequest);
  return takePage(rows, pageRequest, toWordDto);
}
