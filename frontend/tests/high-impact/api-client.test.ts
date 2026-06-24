import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiInstanceMock = vi.hoisted(() => {
  const fn = vi.fn();
  Object.assign(fn, {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  });
  return fn;
});

const axiosCreateMock = vi.hoisted(() => vi.fn());
const axiosGetMock = vi.hoisted(() => vi.fn());
const axiosPostMock = vi.hoisted(() => vi.fn());

vi.mock('axios', () => {
  const axiosLike = {
    create: axiosCreateMock,
    get: axiosGetMock,
    post: axiosPostMock,
  };
  return {
    default: axiosLike,
    ...axiosLike,
  };
});

type RequestConfig = {
  method?: string;
  headers: Record<string, string>;
  _retryCount?: number;
  _retry?: boolean;
  _csrfRetry?: boolean;
};

type ResponseError = {
  config: RequestConfig;
  response?: {
    status: number;
    data?: Record<string, unknown>;
  };
};

type ApiMock = ReturnType<typeof vi.fn> & {
  (config: RequestConfig): Promise<unknown>;
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  interceptors: {
    request: { use: ReturnType<typeof vi.fn> };
    response: { use: ReturnType<typeof vi.fn> };
  };
};

async function loadModule() {
  vi.resetModules();
  axiosCreateMock.mockImplementation(() => apiInstanceMock);
  return import('../../src/lib/api');
}

function makeTokenWithExp(expInMs: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(expInMs / 1000) }));
  return `${header}.${payload}.signature`;
}

describe('api client', () => {
  beforeEach(() => {
    const api = apiInstanceMock as unknown as ApiMock;
    api.mockReset();
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.patch.mockReset();
    api.delete.mockReset();
    api.interceptors.request.use.mockReset();
    api.interceptors.response.use.mockReset();

    axiosCreateMock.mockReset();
    axiosGetMock.mockReset();
    axiosPostMock.mockReset();

    localStorage.clear();
    document.cookie = 'csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    vi.useRealTimers();
  });

  it('configures axios and registers interceptors', async () => {
    const mod = await loadModule();
    const api = apiInstanceMock as unknown as ApiMock;

    expect(mod.API_BASE_URL).toContain('/api/v1');
    expect(axiosCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: mod.API_BASE_URL, withCredentials: true, timeout: 30000 })
    );
    expect(api.interceptors.request.use).toHaveBeenCalledTimes(1);
    expect(api.interceptors.response.use).toHaveBeenCalledTimes(1);
  });

  it('adds auth and csrf headers in request interceptor', async () => {
    await loadModule();
    const api = apiInstanceMock as unknown as ApiMock;
    const requestHandler = api.interceptors.request.use.mock.calls[0][0] as (config: RequestConfig) => Promise<RequestConfig>;

    localStorage.setItem('accessToken', 'token-a');
    document.cookie = 'csrf-token=cookie-csrf';

    const config = await requestHandler({ method: 'post', headers: {} });
    expect(config.headers.Authorization).toBe('Bearer token-a');
    expect(config.headers['X-CSRF-Token']).toBe('cookie-csrf');
  });

  it('fetches csrf token and refreshes near-expiring access tokens', async () => {
    await loadModule();
    const api = apiInstanceMock as unknown as ApiMock;
    const requestHandler = api.interceptors.request.use.mock.calls[0][0] as (config: RequestConfig) => Promise<RequestConfig>;

    const expiring = makeTokenWithExp(Date.now() + 30_000);
    localStorage.setItem('accessToken', expiring);
    localStorage.setItem('refreshToken', 'refresh-1');

    axiosPostMock.mockResolvedValue({
      data: {
        data: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        },
      },
    });

    axiosGetMock.mockResolvedValue({ data: { csrfToken: 'fetched-csrf' } });

    const config = await requestHandler({ method: 'post', headers: {} });

    expect(localStorage.getItem('accessToken')).toBe('new-access');
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
    expect(config.headers.Authorization).toBe('Bearer new-access');
    expect(config.headers['X-CSRF-Token']).toBe('fetched-csrf');
    expect(axiosGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/csrf-token'), expect.any(Object));
  });

  it('handles 403 csrf retry, server retry backoff, and 401 refresh', async () => {
    await loadModule();
    const api = apiInstanceMock as unknown as ApiMock;
    const responseHandler = api.interceptors.response.use.mock.calls[0][1] as (error: ResponseError) => Promise<unknown>;

    api.mockResolvedValue({ ok: true });

    const csrfResult = await responseHandler({
      config: { method: 'post', headers: {} },
      response: { status: 403, data: { csrfToken: 'retry-csrf' } },
    });

    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ 'X-CSRF-Token': 'retry-csrf' }) })
    );
    expect(csrfResult).toEqual({ ok: true });

    vi.useFakeTimers();
    api.mockResolvedValueOnce({ retryOk: true });
    const retryPromise = responseHandler({
      config: { method: 'get', headers: {}, _retryCount: 0 },
      response: { status: 500 },
    });
    await vi.runAllTimersAsync();
    await expect(retryPromise).resolves.toEqual({ retryOk: true });

    localStorage.setItem('refreshToken', 'refresh-401');
    axiosPostMock.mockResolvedValue({
      data: {
        data: {
          accessToken: 'a401',
          refreshToken: 'r401',
        },
      },
    });
    api.mockResolvedValueOnce({ refreshed: true });

    await expect(
      responseHandler({
        config: { method: 'get', headers: {} },
        response: { status: 401 },
      })
    ).resolves.toEqual({ refreshed: true });

    expect(axiosPostMock).toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), { refreshToken: 'refresh-401' });
    expect(localStorage.getItem('accessToken')).toBe('a401');
  });

  it('rejects 401 when no refresh token is available', async () => {
    await loadModule();
    const api = apiInstanceMock as unknown as ApiMock;
    const responseHandler = api.interceptors.response.use.mock.calls[0][1] as (error: ResponseError) => Promise<unknown>;

    const error: ResponseError = {
      config: { method: 'get', headers: {} },
      response: { status: 401 },
    };

    await expect(responseHandler(error)).rejects.toBe(error);
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('routes all domain api wrappers to the expected endpoints', async () => {
    const mod = await loadModule();
    const api = apiInstanceMock as unknown as ApiMock;

    api.get.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });
    api.delete.mockResolvedValue({ data: {} });

    await mod.authApi.login('a@v2-hub.test', 'secret');
    await mod.authApi.register({ email: 'b@v2-hub.test', password: 'secret', fullName: 'Beta User' });
    await mod.authApi.logout();
    await mod.authApi.refreshToken('refresh-token');
    await mod.authApi.forgotPassword('a@v2-hub.test');
    await mod.authApi.resetPassword('token', 'new-pass');
    await mod.authApi.getProfile();
    await mod.authApi.get2FAStatus();
    await mod.authApi.setup2FA();
    await mod.authApi.enable2FA('123456');
    await mod.authApi.disable2FA('123456');
    await mod.authApi.verify2FA('user-1', '123456', false);
    await mod.authApi.regenerateBackupCodes('123456');

    await mod.modulesApi.getAll(true);
    await mod.modulesApi.getById('module-1');
    await mod.modulesApi.create({ template_type: 'menu_service', name: 'Module 1' });
    await mod.modulesApi.update('module-1', { name: 'Module Updated' });
    await mod.modulesApi.delete('module-1', true);

    await mod.inventoryApi.getItems({ page: 1 });
    await mod.inventoryApi.getRecipe('menu-item-1');
    await mod.inventoryApi.updateRecipe('menu-item-1', [{ ingredientId: 'ing-1', quantity: 2 }]);
    await mod.inventoryApi.getSessionRecipe('session-1');
    await mod.inventoryApi.updateSessionRecipe('session-1', [{ ingredientId: 'ing-2', quantity: 1 }]);

    await mod.paymentsApi.createPaymentIntent({ amount: 1500, referenceType: 'order', referenceId: 'order-1' });
    await mod.supportApi.submitContact({
      name: 'Support User',
      email: 'support@v2-hub.test',
      subject: 'Need help',
      message: 'Please assist',
    });

    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'a@v2-hub.test', password: 'secret' });
    expect(api.delete).toHaveBeenCalledWith('/admin/modules/module-1?force=true');
    expect(api.post).toHaveBeenCalledWith('/support/contact', expect.objectContaining({ subject: 'Need help' }));
  });
});
