// src/lib/api.ts

const defaultBackend = "https://agent-pilgrims-api.onrender.com";
const isLocal = window.location.hostname === "localhost";
// Use Vite's build-time env var when available (VITE_*). This lets Render
// inject the backend URL at build time without changing source code.
export const API_BASE_URL = isLocal
  ? "http://localhost:4000"
  : (import.meta.env.VITE_API_BASE_URL || defaultBackend);
