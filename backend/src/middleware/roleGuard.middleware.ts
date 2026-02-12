import { authorize } from "./auth.middleware.js";

export const roleGuard = (roles: string[]) => authorize(...roles);
