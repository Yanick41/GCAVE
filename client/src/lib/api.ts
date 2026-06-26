import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Sprint 1 : intercepteur JWT (Authorization: Bearer <token>)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sgc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
