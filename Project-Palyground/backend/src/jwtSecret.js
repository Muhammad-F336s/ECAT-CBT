/**
 * Centralized JWT secret resolver.
 *
 * Throws a hard startup error in ALL environments if JWT_SECRET is missing.
 * Removes every hardcoded fallback — there is no silent default.
 */

if (!process.env.JWT_SECRET) {
  throw new Error(
    "[FATAL] JWT_SECRET environment variable is not set. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
      "and add it to your .env file.",
  );
}

export const JWT_SECRET = process.env.JWT_SECRET;
