import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8787/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically attach authorization token across outgoing sessions
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for handling 401 unauthorized / expired tokens gracefully
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If token is invalid or expired, clear invalid storage items
      const isAuthPath = window.location.pathname.startsWith("/auth");
      if (!isAuthPath && localStorage.getItem("token")) {
        console.warn("[API Interceptor] Token expired or invalid (401). Clearing session.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    return Promise.reject(error);
  }
);

export default API;
