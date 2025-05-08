// Force Node.js-compatible fetch implementation
global.fetch = require('node-fetch');

// Add MessagePort polyfill for Node.js environment
global.MessagePort = class MessagePort {
  constructor() {}
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
  start() {}
  close() {}
};

// Add MessageChannel polyfill
global.MessageChannel = class MessageChannel {
  constructor() {
    this.port1 = new MessagePort();
    this.port2 = new MessagePort();
  }
};

// Add performance polyfill
global.performance = {
  now: () => Date.now(),
  mark: () => {},
  measure: () => {},
  getEntriesByName: () => [],
  getEntriesByType: () => [],
  getEntries: () => [],
  clearMarks: () => {},
  clearMeasures: () => {},
  clearResourceTimings: () => {},
  setResourceTimingBufferSize: () => {},
  onresourcetimingbufferfull: null,
  timeOrigin: Date.now()
};