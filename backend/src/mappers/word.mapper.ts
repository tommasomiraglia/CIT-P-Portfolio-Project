// Converts a word row into the WordDto the API sends.
import type { WordDto, WordRow } from '../types/word.js';

// The titles that contain the word. encodeURIComponent keeps a word such as "rock&roll"
// from breaking the query string.
export function titlesWithWordUrl(word: string): string {
  return `/api/titles?words=${encodeURIComponent(word)}&match=any`;
}

export function toWordDto(row: WordRow): WordDto {
  return {
    url: titlesWithWordUrl(row.word),
    word: row.word,
    frequency: row.freq,
  };
}
