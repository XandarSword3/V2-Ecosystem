import { 
  AppError, 
  ValidationError, 
  BadRequestError, 
  AuthenticationError, 
  InvalidTokenError, 
  ForbiddenError, 
  NotFoundError, 
  ConflictError, 
  RateLimitError, 
  InternalError,
  isAppError,
  isOperationalError
} from '../../src/utils/errors';

describe('Error Classes', () => {
  it('AppError should set correct properties', () => {
    const err = new AppError('test', 418, 'TEAPOT', true, { extra: 'data' });
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('TEAPOT');
    expect(err.isOperational).toBe(true);
    expect(err.details).toEqual({ extra: 'data' });
  });

  it('ValidationError should set default message and code', () => {
    const err = new ValidationError('bad input', [{ path: ['f'], message: 'm' }]);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.errors).toHaveLength(1);
  });

  it('BadRequestError should set default message and code', () => {
    const err = new BadRequestError();
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Bad request');
  });

  it('AuthenticationError should set 401', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
  });

  it('InvalidTokenError should set 401', () => {
    const err = new InvalidTokenError();
    expect(err.statusCode).toBe(401);
  });

  it('ForbiddenError should set 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it('NotFoundError should handle identifier', () => {
    const err = new NotFoundError('User', '123');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("'123'");
  });

  it('NotFoundError should handle no identifier', () => {
    const err = new NotFoundError('User');
    expect(err.message).toBe('User not found');
  });

  it('ConflictError should set 409', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
  });

  it('RateLimitError should set 429', () => {
    const err = new RateLimitError('Too fast', 60);
    expect(err.statusCode).toBe(429);
    expect(err.details?.retryAfterSeconds).toBe(60);
  });

  it('InternalError should set 500 and isOperational=false', () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(false);
  });

  describe('Type Guards', () => {
    it('isAppError should identify AppError', () => {
      expect(isAppError(new AppError('m', 500, 'c'))).toBe(true);
      expect(isAppError(new Error('m'))).toBe(false);
    });

    it('isOperationalError should identify operational AppError', () => {
      expect(isOperationalError(new AppError('m', 400, 'c', true))).toBe(true);
      expect(isOperationalError(new AppError('m', 500, 'c', false))).toBe(false);
      expect(isOperationalError(new Error('m'))).toBe(false);
    });
  });
});
