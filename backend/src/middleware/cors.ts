// Cross-origin resource sharing policy (2-D.7, docs/api-design.md section 5).
//
// A browser only lets a page read a response from another origin (scheme, host and port)
// when the response says that origin is allowed. The frontend runs on a different origin
// than this API, so without these headers the browser would block every call it makes.
// For requests that are not "simple" (for example with an Authorization header or a JSON
// body), the browser first sends an OPTIONS "preflight" request; this middleware answers it.
//
// CORS only restricts browsers. It is not access control: curl or another server can call
// the API from anywhere, which is why authentication is checked separately.
import cors from 'cors';
import { config } from '../config/index.js';

export const corsPolicy = cors({
  // Only the listed origins get an Access-Control-Allow-Origin header back; for any other
  // origin the header is left out and the browser blocks the response.
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  // Authorization carries the JWT (section 4.2). Content-Type is needed for JSON bodies.
  allowedHeaders: ['Content-Type', 'Authorization'],
  // The browser hides most response headers from cross-origin pages. Location is the URI
  // of a resource created with POST (section 1.6), so the frontend must be able to read it.
  exposedHeaders: ['Location'],
  // The token travels in a header, not a cookie, so no credentials mode is needed.
  credentials: false,
  // Lets the browser reuse a preflight answer for an hour instead of asking again each time.
  maxAge: 3600,
});
