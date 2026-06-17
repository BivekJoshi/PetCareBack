/**
 * Standard success envelope for all API responses.
 *   { success: true, message, data }
 */
export const sendSuccess = (res, { statusCode = 200, message = 'Success', data = null } = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};
