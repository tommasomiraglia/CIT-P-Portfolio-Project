// A user's rating of a title as the database returns it and as the API sends it
// (docs/api-design.md 1.8).

// One row of get_rating_history(), and of the query for a single rating.
export interface RatingRow {
  tconst: string;
  primarytitle: string;
  value: number;
  comment: string | null;
}

// The body of PUT /api/users/:userId/ratings/:titleId after the controller validated it.
export interface RatingInput {
  rating: number;
  comment: string | null;
}

// A reference to a title: its URI and a label to display (docs/api-design.md 2.4).
export interface TitleReferenceDto {
  url: string;
  name: string;
}

export interface RatingDto {
  url: string;
  title: TitleReferenceDto;
  rating: number;
  comment: string | null;
}
