import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8787/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatially attach authorization token across outgoing sessions
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
