/**
 * Sends a captured frame (base-64 data URL) to the backend /analyze endpoint.
 * The backend proxies to Gemini — no API key needed on the frontend.
 *
 * @param {string} dataUrl  JPEG data URL from the camera
 * @param {AbortSignal} [signal]  Optional cancellation signal for inflight analysis
 * @returns {Promise<{analysis: object, incident_id: string|null}>}
 */
export async function analyzeFrame(dataUrl, signal) {
  // Convert base-64 data URL → Blob
  const res = await fetch(dataUrl, { signal });
  const blob = await res.blob();

  const form = new FormData();
  form.append("file", blob, "frame.jpg");

  const response = await fetch("/analyze", {
    method: "POST",
    body: form,
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Analyze failed (${response.status}): ${text}`);
  }

  return response.json();
}

/**
 * Fetches recent incidents from the backend.
 *
 * @param {number} limit  Max number of incidents to return (default 50)
 * @returns {Promise<Array>}
 */
export async function getIncidents(limit = 50) {
  const response = await fetch(`/incidents?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch incidents (${response.status})`);
  }
  return response.json();
}

export async function getStats() {
  const response = await fetch("/stats");
  if (!response.ok) {
    throw new Error(`Failed to fetch stats (${response.status})`);
  }
  return response.json();
}

export async function resolveIncident(id) {
  const response = await fetch(`/incidents/${id}/resolve`, { method: "POST" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resolve failed (${response.status}): ${text}`);
  }
  return response.json();
}
