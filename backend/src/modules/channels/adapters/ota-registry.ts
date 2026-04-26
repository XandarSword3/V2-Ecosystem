import type { OTAAdapter } from './ota-adapter.interface.js';
import { SiteMinderAdapter } from './siteminder.adapter.js';

const adapters = new Map<string, OTAAdapter>();

export function registerOTAAdapter(name: string, adapter: OTAAdapter): void {
  adapters.set(name, adapter);
}

export function getOTAAdapter(name: string): OTAAdapter {
  const adapter = adapters.get(name);
  if (!adapter) {
    throw new Error(`Adapter not registered: ${name}`);
  }
  return adapter;
}

export function listOTAAdapters(): string[] {
  return Array.from(adapters.keys());
}

registerOTAAdapter('siteminder', new SiteMinderAdapter());
