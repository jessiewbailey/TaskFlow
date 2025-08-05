// Jest setup file to add necessary polyfills
require('whatwg-fetch');

// Mock import.meta.env
global.importMeta = {
  env: {
    VITE_API_BASE_URL: '',
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false,
  }
};

// Add import.meta to the global scope for tests
Object.defineProperty(global, 'import', {
  value: {
    meta: global.importMeta
  },
  configurable: true,
  writable: true
});

// Polyfill TextEncoder/TextDecoder
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Add Response polyfill if needed
if (typeof Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      this.init = init;
      this.ok = init?.status >= 200 && init?.status < 300;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
    }
    
    async json() {
      return JSON.parse(this.body);
    }
    
    async text() {
      return this.body;
    }
  };
}

// Add TransformStream polyfill
if (typeof TransformStream === 'undefined') {
  global.TransformStream = class TransformStream {
    constructor() {
      this.readable = null;
      this.writable = null;
    }
  };
}