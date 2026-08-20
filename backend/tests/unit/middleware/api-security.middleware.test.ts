import type { Request, Response, NextFunction } from 'express';
import { xssSanitizer } from '../../../src/middleware/api-security.middleware.js';

describe('xssSanitizer Express 5 compatibility', () => {
  it('sanitizes a getter-only req.query without replacing the property', () => {
    const query = {
      search: '<script>alert(1)</script>',
    };
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn<NextFunction>();

    Object.defineProperty(req, 'query', {
      configurable: true,
      enumerable: true,
      get: () => query,
    });

    xssSanitizer(req, res, next);

    expect(query.search).not.toContain('<script>');
    expect(req.query).toBe(query);
    expect(next).toHaveBeenCalledOnce();
  });
});
