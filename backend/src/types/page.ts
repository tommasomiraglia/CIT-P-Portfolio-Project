// Types for paged lists (docs/api-design.md section 3). The functions that work with
// them are in lib/paging.ts.

// The page a client asked for, after validation and after applying the defaults.
export interface PageRequest {
  page: number;
  pageSize: number;
}

// One page of results, before it gets its links. Services return this: it says whether
// another page exists without knowing anything about URLs or HTTP.
export interface PageSlice<T> {
  items: T[];
  hasNext: boolean;
}

// The envelope every list endpoint sends (section 3.2).
export interface Page<T> {
  items: T[];
  page: number;
  // The size actually used, which differs from the requested one when that was above
  // the maximum, so the client can see that the default was applied.
  pageSize: number;
  prev: string | null;
  next: string | null;
}
