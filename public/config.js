// config.js

// Detect whether we're running locally or on a hosted environment
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Centralized configuration
export const CONFIG = {
  // WebSocket URL automatically switches based on environment
  WS_URL: isLocal
    ? "ws://localhost:8080"
    : "wss://maintest-5ltj.onrender.com",

  // Optional: define API base if you later add REST endpoints
  API_URL: isLocal
    ? "http://localhost:8080"
    : "https://maintest-5ltj.onrender.com",

  // Add anything else you want (debug flags, asset URLs, etc.)
  DEBUG: isLocal, // enables extra logging locally
};
