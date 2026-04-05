import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalNodeEnv = process.env.NODE_ENV;

async function loadLogger(nodeEnv: string, debugFlag?: 'true' | 'false') {
  vi.resetModules();
  process.env.NODE_ENV = nodeEnv;

  localStorage.removeItem('v2-debug');
  if (debugFlag) {
    localStorage.setItem('v2-debug', debugFlag);
  }

  return import('../../src/lib/logger');
}

describe('logger utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    localStorage.removeItem('v2-debug');
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('logs all levels outside production', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { createLogger } = await loadLogger('test');
    const logger = createLogger('Unit');

    logger.debug('debug message', { id: 1 });
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message', { cause: 'boom' });

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    expect(String(debugSpy.mock.calls[0][0])).toContain('[Unit] debug message');
    expect(String(errorSpy.mock.calls[0][0])).toContain('[Unit] error message');
  });

  it('suppresses non-error logs in production without debug flag', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { createLogger } = await loadLogger('production');
    const logger = createLogger('Prod');

    logger.debug('hidden debug');
    logger.info('hidden info');
    logger.warn('hidden warn');
    logger.error('visible error');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('allows info logs in production when debug flag is enabled', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { createLogger } = await loadLogger('production', 'true');
    const logger = createLogger('ProdDebug');

    logger.info('info enabled');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(String(infoSpy.mock.calls[0][0])).toContain('[ProdDebug] info enabled');
  });
});
