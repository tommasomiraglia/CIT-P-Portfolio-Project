// Loads and validates the application configuration once, at startup.
// Every other module imports `config` from here instead of reading process.env directly.

// Optional: the HTTP port has a sensible default, unlike the database credentials.
const DEFAULT_PORT = 3000;

// Optional: where the frontend runs during development. 5173 is the port of Vite's dev server.
const DEFAULT_CORS_ORIGINS = ['http://localhost:5173'];

const REQUIRED_VARIABLES = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
] as const;

// HS256 signs with a 256-bit key, so a shorter secret would be the weakest part.
// 32 characters of random base64 hold more than 256 bits.
const MIN_JWT_SECRET_LENGTH = 32;

type RequiredVariable = (typeof REQUIRED_VARIABLES)[number];

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface AppConfig {
  port: number;
  // Web pages served from these origins may call the API from the browser (2-D.7).
  corsOrigins: string[];
  // Signs and verifies login tokens (docs/api-design.md section 4.2). Anyone who knows it
  // can create a token for any user, so it only ever lives in backend/.env.
  jwtSecret: string;
  db: DatabaseConfig;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

// Reads backend/.env into process.env. Variables that are already set in the
// environment win, so the same code also works where no .env file exists.
function loadEnvFile(): void {
  try {
    process.loadEnvFile(new URL('../../.env', import.meta.url));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function readRequired(): Record<RequiredVariable, string> {
  const values: Partial<Record<RequiredVariable, string>> = {};
  const missing: RequiredVariable[] = [];
  for (const name of REQUIRED_VARIABLES) {
    const value = process.env[name]?.trim();
    if (value) {
      values[name] = value;
    } else {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy backend/.env.example to backend/.env and fill in every value.',
    );
  }
  // Safe: the loop above stored every variable that is not in `missing`, and `missing` is empty.
  return values as Record<RequiredVariable, string>;
}

function parsePort(name: string, value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`${name} must be an integer between 1 and 65535, got "${value}".`);
  }
  return port;
}

// An origin is scheme, host and port only, for example "http://localhost:5173".
// A trailing slash or a path would never equal the Origin header a browser sends,
// so the frontend would be blocked with no clear reason; better to fail at startup.
function parseOrigins(name: string, value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
  for (const origin of origins) {
    if (!URL.canParse(origin) || new URL(origin).origin !== origin) {
      throw new ConfigError(
        `${name} must be a comma-separated list of origins like "http://localhost:5173", got "${origin}".`,
      );
    }
  }
  if (origins.length === 0) {
    throw new ConfigError(`${name} is set but lists no origin.`);
  }
  return origins;
}

function checkJwtSecret(value: string): string {
  if (value.length < MIN_JWT_SECRET_LENGTH) {
    throw new ConfigError(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long. Generate one with: ` +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`,
    );
  }
  return value;
}

function loadConfig(): AppConfig {
  loadEnvFile();
  const env = readRequired();
  const port = process.env.PORT?.trim();
  const corsOrigins = process.env.CORS_ORIGINS?.trim();
  return {
    port: port ? parsePort('PORT', port) : DEFAULT_PORT,
    corsOrigins: corsOrigins ? parseOrigins('CORS_ORIGINS', corsOrigins) : DEFAULT_CORS_ORIGINS,
    jwtSecret: checkJwtSecret(env.JWT_SECRET),
    db: {
      host: env.DB_HOST,
      port: parsePort('DB_PORT', env.DB_PORT),
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    },
  };
}

export const config: AppConfig = loadConfig();
