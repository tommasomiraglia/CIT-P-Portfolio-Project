// Converts a names row from the database into the PersonDto the API sends.

import type {
  CoPlayerDto,
  CoPlayerRow,
  KnownForTitleDto,
  PersonDto,
  PersonKnownForRow,
  PersonProfessionRow,
  PersonRow,
  PersonSearchRow,
  PersonSummaryDto,
  PersonWordDto,
  PersonWordRow,
} from '../types/person.js';

export function toPersonSummaryDto(row: PersonSearchRow): PersonSummaryDto {
  return {
    url: `/api/people/${row.nconst}`,
    id: row.nconst,
    name: row.primaryname,
  };
}

// One knownFor row turns into { url, title } for the API.
function toKnownForTitleDto(row: PersonKnownForRow): KnownForTitleDto {
  return {
    url: `/api/titles/${row.tconst}`,
    title: row.primarytitle,
  };
}

// One co_players row results a co-player in a list: a person in a list plus the number of shared titles
export function toCoPlayerDto(row: CoPlayerRow): CoPlayerDto {
  return {
    url: `/api/people/${row.nconst}`,
    id: row.nconst,
    name: row.primaryname,
    sharedTitles: row.freq,
  };
}

export function toPersonWordDto(row: PersonWordRow): PersonWordDto {
  return {
    url: `/api/titles?words=${encodeURIComponent(row.word)}&match=any`,
    word: row.word,
    frequency: row.freq,
  };
}

// Builds the person detail from the three query results (person, professions, known-for titles).
// Co-players and words can be long lists, so they are linked, not embedded
// (docs/api-design.md 2.4).
export function toPersonDto(
  person: PersonRow,
  professions: PersonProfessionRow[],
  knownFor: PersonKnownForRow[],
): PersonDto {
  const url = `/api/people/${person.nconst}`;
  return {
    url,
    id: person.nconst,
    name: person.primaryname,
    birthYear: person.birthyear,
    deathYear: person.deathyear,
    professions: professions.map((row) => row.name),
    rating: person.rating,
    knownFor: knownFor.map(toKnownForTitleDto),
    coPlayersUrl: `${url}/co-players`,
    wordsUrl: `${url}/words`,
  };
}
