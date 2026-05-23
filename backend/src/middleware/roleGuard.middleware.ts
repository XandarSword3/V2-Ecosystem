import { authorize } from "./auth.middleware.js";

/**
 * @deprecated Use `authorize()` from auth.middleware.ts directly instead.
 * This is a redundant wrapper that adds no value over the direct call.
 * Will be removed in a future release.
 */
export const roleGuard = (roles: string[]) => authorize(...roles);

// Alias used by support.routes.ts — accepts array or spread
export const requireRole = (roles: string | string[], ...rest: string[]) =>
  Array.isArray(roles) ? authorize(...roles) : authorize(roles, ...rest);
