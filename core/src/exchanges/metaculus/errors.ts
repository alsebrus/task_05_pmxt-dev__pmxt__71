import { ErrorMapper } from '../../utils/error-mapper';

/**
 * Maps Metaculus API errors to PMXT unified error classes.
 * Metaculus uses standard HTTP status codes with JSON error bodies.
 */
export const metaculusErrorMapper = new ErrorMapper('Metaculus');