import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: configuredBaseUrl || '/api'
});

// Request interceptor to add the auth token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('postpilot_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('postpilot_token');
      localStorage.removeItem('postpilot_user');
    }
    return Promise.reject(error);
  }
);

export default api;
