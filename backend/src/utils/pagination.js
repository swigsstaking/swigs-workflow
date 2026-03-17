/**
 * Parse pagination parameters from query string.
 * Returns { page, limit, skip } with safe defaults and bounds.
 */
export const parsePagination = (query, defaultLimit = 50, maxLimit = 100) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit) || defaultLimit), maxLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};
