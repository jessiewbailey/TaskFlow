// Polyfill for import.meta in Node.js/Jest environment
if (typeof globalThis !== 'undefined' && !globalThis.import) {
  const mockImportMeta = {
    env: {
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:8000',
      MODE: process.env.NODE_ENV || 'test',
      DEV: false,
      PROD: false,
      SSR: false,
    }
  };
  
  globalThis.import = {
    meta: mockImportMeta
  };
  
  // Also set on global for older Node versions
  if (typeof global !== 'undefined') {
    global.import = globalThis.import;
  }
}