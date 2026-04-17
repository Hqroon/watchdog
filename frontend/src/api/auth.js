export function getAuthHeaders() {
  const token = localStorage.getItem("watchdog_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
