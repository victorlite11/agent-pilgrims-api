// src/lib/api.ts

const defaultBackend = "https://agent-pilgrims-api.onrender.com";
const isLocal = window.location.hostname === "localhost";
// Use Vite's build-time env var when available (VITE_*). When not provided,
// prefer the current window origin at runtime so the SPA talks to the same
// host that served it (avoids CORS issues when the service URL changes).
export const API_BASE_URL = isLocal
  ? "http://localhost:4000"
  : (import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : defaultBackend));
