/**
 * Low-level WebSocket factory used by the useWebSocket hook.
 * Exported separately so it can be replaced with a mock in tests.
 */

export function createWebSocket(path) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const url = `${protocol}://${window.location.host}${path}`;
  return new WebSocket(url);
}
