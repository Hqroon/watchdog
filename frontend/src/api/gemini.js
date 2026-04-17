import { API_BASE } from '../config.js'

export async function analyzeFrame(dataUrl, signal) {
  const res = await fetch(dataUrl, { signal });
  const blob = await res.blob();

  const form = new FormData();
  form.append("file", blob, "frame.jpg");

  const response = await fetch(`${API_BASE}/analyze`, {
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

export async function getIncidents(limit = 50) {
  const response = await fetch(`${API_BASE}/incidents?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch incidents (${response.status})`);
  }
  return response.json();
}

export async function getStats() {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch stats (${response.status})`);
  }
  return response.json();
}

export async function resolveIncident(id) {
  const response = await fetch(`${API_BASE}/incidents/${id}/resolve`, { method: "POST" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resolve failed (${response.status}): ${text}`);
  }
  return response.json();
}
