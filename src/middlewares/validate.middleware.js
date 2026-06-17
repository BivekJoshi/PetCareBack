import { ApiError } from '../utils/ApiError.js';

/**
 * Validates req against a Zod schema shaped as
 *   { body?, query?, params? }
 * On success, replaces each segment with the parsed (and coerced) value.
 */
export const validate = (schema) => (req, _res, next) => {
  try {
    if (schema.body) req.body = schema.body.parse(req.body);
    if (schema.query) req.query = schema.query.parse(req.query);
    if (schema.params) req.params = schema.params.parse(req.params);
    next();
  } catch (err) {
    if (err.errors) {
      const details = err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    next(err);
  }
};
