// Decides whether the API is healthy. Today that means "the database answers".
import { ServiceUnavailableError } from '../middleware/errors.js';
import { pingDatabase } from '../repositories/health.repository.js';

export async function checkHealth(): Promise<void> {
  try {
    await pingDatabase();
  } catch (error) {
    // The reason (wrong password, server down, ...) is useful to us but not to clients.
    // Log the whole error: a refused connection to "localhost" is an AggregateError
    // (one attempt per IPv4/IPv6 address) whose own message is empty.
    console.error('Health check failed:', error);
    throw new ServiceUnavailableError('Database unavailable');
  }
}
