// Jest setup file to add necessary polyfills
require('whatwg-fetch');

// Mock import.meta.env for Vite
const mockImportMeta = {
  env: {
    VITE_API_BASE_URL: 'http://localhost:8000',
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false,
  }
};

// Store reference for later use
global.importMeta = mockImportMeta;

// Set up import.meta for Node.js/Jest environment
// This needs to be done before any modules that use import.meta are loaded
if (typeof globalThis.import === 'undefined') {
  globalThis.import = {};
}
globalThis.import.meta = mockImportMeta;

// Also set on global for compatibility
if (typeof global.import === 'undefined') {
  global.import = {};
}
global.import.meta = mockImportMeta;

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

// Add BroadcastChannel polyfill for MSW v2
if (typeof BroadcastChannel === 'undefined') {
  global.BroadcastChannel = class BroadcastChannel {
    constructor(name) {
      this.name = name;
    }
    
    postMessage(message) {
      // Mock implementation - just log or ignore
    }
    
    close() {
      // Mock implementation
    }
    
    addEventListener() {
      // Mock implementation
    }
    
    removeEventListener() {
      // Mock implementation
    }
  };
}