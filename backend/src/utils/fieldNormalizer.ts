/**
 * Field Name Normalization Utility
 * 
 * Converts between snake_case and camelCase field names
 * to handle frontend/backend naming convention differences.
 */

/**
 * Converts a snake_case string to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts a camelCase string to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Recursively converts all keys in an object from snake_case to camelCase
 */
export function normalizeToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeToSnakeCase);
  if (typeof obj !== 'object') return obj;

  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    normalized[snakeKey] = normalizeToSnakeCase(value);
  }
  return normalized;
}

/**
 * Recursively converts all keys in an object from snake_case to camelCase
 */
export function normalizeToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeToCamelCase);
  if (typeof obj !== 'object') return obj;

  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    normalized[camelKey] = normalizeToCamelCase(value);
  }
  return normalized;
}

/**
 * Normalizes request body to support both snake_case and camelCase
 * Returns an object with both versions of each field for maximum compatibility
 */
export function normalizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(normalizeRequestBody);

  const result: Record<string, any> = { ...body };
  
  for (const [key, value] of Object.entries(body)) {
    // Add camelCase version if key is snake_case
    if (key.includes('_')) {
      const camelKey = snakeToCamel(key);
      if (result[camelKey] === undefined) {
        result[camelKey] = typeof value === 'object' ? normalizeRequestBody(value) : value;
      }
    }
    // Add snake_case version if key is camelCase
    if (/[A-Z]/.test(key)) {
      const snakeKey = camelToSnake(key);
      if (result[snakeKey] === undefined) {
        result[snakeKey] = typeof value === 'object' ? normalizeRequestBody(value) : value;
      }
    }
  }
  
  return result;
}
