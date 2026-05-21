import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';
import { AppFeedback } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function getAuthHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  return { Authorization: `Basic ${session.token}` };
}

export async function submitFeedback(data: {
  title: string;
  description: string;
  rating: number;
}): Promise<void> {
  await axios.post(`${BASE_URL}/api/feedback`, data, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
  });
}

export async function getAdminFeedback(
  page = 0,
  limit = 20,
): Promise<{ data: AppFeedback[]; total: number }> {
  const { data } = await axios.get(`${BASE_URL}/api/admin/feedback`, {
    params: { page, limit },
    headers: getAuthHeader(),
  });
  return data;
}
