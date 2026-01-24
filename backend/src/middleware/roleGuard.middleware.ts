import { authorize } from './auth.middleware';

export const roleGuard = (roles: string[]) => authorize(...roles);
