import axios from "axios";
const api = axios.create({ timeout: 15000 });
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config?.headers?.Authorization ===
        `Bearer ${localStorage.getItem("token")}`
    ) {
      window.dispatchEvent(new Event("session-invalid"));
    }
    return Promise.reject(error);
  },
);
export default api;
