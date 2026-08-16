import { ApiClient } from '@vestara/client';

export const apiBase = import.meta.env.VITE_VESTARA_API_URL ?? 'http://127.0.0.1:4310';
export const imageClient = new ApiClient({ apiBase });
