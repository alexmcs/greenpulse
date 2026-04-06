import axios from 'axios';
import Constants from 'expo-constants';
import { authService } from './auth';

const BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:8000/api/v1';

export const apiClient = axios.create({ baseURL: BASE_URL });

// Attach Supabase JWT to every request
apiClient.interceptors.request.use(async config => {
  const session = await authService.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Retry with exponential backoff for /verify endpoint
apiClient.interceptors.response.use(undefined, async error => {
  const config = error.config;
  if (!config || !config.url?.includes('/verify')) return Promise.reject(error);
  config._retryCount = config._retryCount ?? 0;
  if (config._retryCount >= 3) return Promise.reject(error);
  config._retryCount += 1;
  await new Promise(r => setTimeout(r, Math.pow(2, config._retryCount) * 500));
  return apiClient(config);
});
