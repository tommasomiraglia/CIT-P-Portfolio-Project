// Reads the ?words=a,b query parameter that the word search (GET /api/titles?words=) and
// the related words (GET /api/words?words=) share (docs/api-design.md 1.17).
import { BadRequestError } from '../middleware/errors.js';

// Bounds the work of one request: the database looks up every word in the word index.
export const MAX_WORDS = 10;
// The longest word in the index has 58 characters, so a longer one can never match.
export const MAX_WORD_LENGTH = 60;

// The index (table wi) stores words in lower case, but only the letters A to Z were
// lowered when it was built: "Élisabeth" is stored with its capital É. Lowering the same
// letters here, and no others, gives the word exactly as the index has it.
function toIndexCase(word: string): string {
  return word.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

// Returns the words without duplicates, in the order they were given.
// A repeated parameter (?words=a&words=b) arrives as an array and is rejected, like
// every other parameter that must be given once.
export function parseWords(value: unknown): string[] {
  const words =
    typeof value === 'string'
      ? value
          .split(',')
          .map((word) => toIndexCase(word.trim()))
          .filter((word) => word !== '')
      : [];
  const unique = [...new Set(words)];
  if (
    unique.length === 0 ||
    unique.length > MAX_WORDS ||
    // A word never contains a space in the index: "twilight zone" is two words.
    unique.some((word) => word.length > MAX_WORD_LENGTH || /\s/.test(word))
  ) {
    throw new BadRequestError(
      `"words" must be given once, as 1 to ${MAX_WORDS} words separated by commas, ` +
        `each without spaces and at most ${MAX_WORD_LENGTH} characters`,
    );
  }
  return unique;
}
