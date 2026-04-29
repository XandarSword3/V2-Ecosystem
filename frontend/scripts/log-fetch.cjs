const originalFetch = global.fetch;

if (typeof originalFetch === 'function') {
  global.fetch = async (...args) => {
    try {
      return await originalFetch(...args);
    } catch (err) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      console.error('[build fetch failed]', url);
      throw err;
    }
  };
}
