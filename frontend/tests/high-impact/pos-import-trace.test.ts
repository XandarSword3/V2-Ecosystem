import { describe, expect, it } from 'vitest';

const waitForImport = async (modulePath: string, timeoutMs = 15000) => {
  const timeoutError = new Error(`Timed out importing ${modulePath}`);

  return Promise.race([
    import(modulePath),
    new Promise((_, reject) => {
      setTimeout(() => reject(timeoutError), timeoutMs);
    }),
  ]);
};

describe('POS import trace', () => {
  it('imports common POS dependencies', async () => {
    const modules = [
      '@/lib/api',
      '@/lib/utils',
      '@/components/ui/Button',
      '@/components/ui/Card',
      'sonner',
      'next-intl',
      '@/lib/auth-context',
      '@/lib/socket',
    ];

    for (const modulePath of modules) {
      console.log(`Import start: ${modulePath}`);

      try {
        await expect(waitForImport(modulePath)).resolves.toBeTruthy();
        console.log(`Import ok: ${modulePath}`);
      } catch (error) {
        throw new Error(`Import failed for ${modulePath}: ${(error as Error).message}`);
      }
    }
  }, 120000);
});