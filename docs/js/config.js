const localHosts = new Set(['localhost', '127.0.0.1']);

export const API_BASE = localHosts.has(window.location.hostname)
  ? 'http://127.0.0.1:8765'
  : 'https://arxistar.duckdns.org/food-api';
