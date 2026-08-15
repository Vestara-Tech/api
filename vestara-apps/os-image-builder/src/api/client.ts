import { ApiClient } from '@vestara/client';

export const apiBase = import.meta.env.VITE_VESTARA_API_URL ?? 'http://localhost:4310';
export const imageClient = new ApiClient({ apiBase });
