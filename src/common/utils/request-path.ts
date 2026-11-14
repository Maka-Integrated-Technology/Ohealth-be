/**
 * Returns request location context without the query string. Query values may
 * contain rejected credentials and must never be copied into logs or errors.
 */
export function safeRequestPath(request: {
  path?: string;
  url?: string;
}): string {
  if (typeof request.path === 'string' && request.path.length > 0) {
    return request.path;
  }

  const [path] = (request.url || '/').split('?', 1);
  return path || '/';
}
