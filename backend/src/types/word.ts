// A word of the word index as the database returns it and as the API sends it
// (docs/api-design.md 2.6, "Word in a list").

// One row of words_query() or person_words(): a word and how often it occurs.
export interface WordRow {
  word: string;
  freq: number;
}

export interface WordDto {
  // A word is not a resource of its own, so the URL is the title search for it.
  url: string;
  word: string;
  frequency: number;
}
