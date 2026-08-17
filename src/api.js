import axios from "axios";

// 创建 axios 实例，baseURL 是你的后端地址
const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

// 请求拦截器：每次发请求前，自动把 token 加到请求头里
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
