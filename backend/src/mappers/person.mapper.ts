// Converts a names row from the database into the PersonDto the API sends.

import type { PersonSearchRow, PersonSummaryDto } from '../types/person.js';


export function toPersonSummaryDto(row: PersonSearchRow): PersonSummaryDto {
  return {
    url: `/api/people/${row.nconst}`,
    id: row.nconst,
    name: row.primaryname,
  };
}