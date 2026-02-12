import path from 'path';

/**
 * Custom error for path traversal attempts
 */
export class PathTraversalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PathTraversalError';
  }
}

/**
 * Resolve a user-supplied path against a base directory and verify it
 * does not escape the base directory (path traversal protection).
 *
 * @param {string} baseDir - Absolute path to the allowed root directory
 * @param {string} userPath - Untrusted, user-supplied relative path
 * @returns {string} The resolved absolute path (guaranteed to be inside baseDir)
 * @throws {PathTraversalError} If the resolved path escapes the base directory
 */
export function safePath(baseDir, userPath) {
  if (!userPath || typeof userPath !== 'string') {
    throw new PathTraversalError('Path must be a non-empty string');
  }

  const resolved = path.resolve(baseDir, userPath);

  // The resolved path must either equal baseDir exactly or be under baseDir + sep
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
    throw new PathTraversalError(
      `Path "${userPath}" resolves outside the allowed directory`
    );
  }

  return resolved;
}
