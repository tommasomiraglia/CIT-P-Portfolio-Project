// Business logic for titles: fetches rows through the repository and returns API objects.

import { toTitleDto } from '../mappers/title.mapper.js';
import { NotFoundError } from '../middleware/errors.js';
import { findTitleById } from '../repositories/title.repository.js';
import type { TitleDto } from '../types/title.js';

export async function getTitle(tconst: string): Promise<TitleDto> {
  const row = await findTitleById(tconst);
  if (!row) {
    throw new NotFoundError(`Title ${tconst} not found`);
  }
  return toTitleDto(row);
}
