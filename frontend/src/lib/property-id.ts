/** Standard UUID format — must match backend propertyAccess.middleware.ts */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STORAGE_KEY = 'activePropertyId';

export function isValidPropertyId(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Read activePropertyId from localStorage, purging stale non-UUID values. */
export function getStoredPropertyId(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  if (isValidPropertyId(stored)) return stored;
  localStorage.removeItem(STORAGE_KEY);
  return null;
}

export function setStoredPropertyId(id: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  if (isValidPropertyId(id)) {
    localStorage.setItem(STORAGE_KEY, id);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
