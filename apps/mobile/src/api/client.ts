import axios from "axios";
import Constants from "expo-constants";
import { useAuthStore } from "../state/authStore";
import { useBrandStore } from "../state/brandStore";

const apiBaseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? "http://localhost:4000";

export const apiClient = axios.create({ baseURL: apiBaseUrl });

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // GET requests to brand-scoped endpoints (menu/combos) need brandId — attaching it
  // here, like Authorization, keeps every screen/api file from having to pass it explicitly.
  const brandId = useBrandStore.getState().selectedBrandId;
  if (brandId && config.method?.toLowerCase() === "get") {
    config.params = { ...config.params, brandId };
  }

  return config;
});

// Every screen's catch block already does `err instanceof Error ? err.message : "..."` to show
// an Alert — without this, that message is axios's own generic "Request failed with status code
// 400" rather than the server's actual reason (e.g. "we don't deliver to X yet"), which is far
// more useful to the customer and was silently getting hidden everywhere at once.
apiClient.interceptors.response.use(undefined, (error) => {
  const serverMessage = error?.response?.data?.error;
  if (typeof serverMessage === "string") {
    error.message = serverMessage;
  }
  return Promise.reject(error);
});
