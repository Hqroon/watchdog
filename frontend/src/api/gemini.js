import { getAuthHeaders } from "./auth.js";

export async function analyzeFrame(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  const form = new FormData();
  form.append("file", blob, "frame.jpg");

  const response = await fetch("/analyze", {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Analyze failed (${response.status}): ${text}`);
  }

  return response.json();
}

export async function getIncidents(limit = 50) {
  const response = await fetch(`/incidents?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch incidents (${response.status})`);
  }
  return response.json();
}
