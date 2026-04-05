import { authorize } from "./auth.middleware.js";

/**
 * @deprecated Use `authorize()` from auth.middleware.ts directly instead.
 * This is a redundant wrapper that adds no value over the direct call.
 * Will be removed in a future release.
 */
export const roleGuard = (roles: string[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[DEPRECATED] roleGuard() is deprecated. Use authorize() from auth.middleware.ts directly.');
  }
  return authorize(...roles);
};
