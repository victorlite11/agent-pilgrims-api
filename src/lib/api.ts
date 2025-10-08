// src/lib/api.ts

const isLocal = window.location.hostname === "localhost";
export const API_BASE_URL = isLocal
  ? "http://localhost:4000"
  : "https://agent-pilgrims-api.onrender.com";
