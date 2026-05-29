// services/tickets.service.ts
// Support ticket system (user side). Talks to the custom /api/me/tickets
// endpoints with the dashboard auth header (Bearer/Basic from the session).

import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const DRUPAL_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function authHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  const prefix = (session as any).tokenType === 'bearer' ? 'Bearer' : 'Basic';
  return { Authorization: `${prefix} ${session.token}` };
}

export type TicketKind = 'support' | 'translation';

export interface Ticket {
  id: string;
  nid: number;
  number: string;          // "#000234"
  title: string;
  kind: TicketKind;
  resolved: boolean;
  tourTitle: string | null;
  createdAt: string;
  lastMessageAt: string;
  unread: number;          // messages unread by the user
  adminUnread: number;
  ownerName?: string | null; // admin view only
}

export interface TicketMessage {
  id: number;
  body: string;
  msgKey: string | null;
  msgParams: Record<string, any> | null;
  authorId: string | null;
  authorName: string | null;
  /** True when the author is support staff (admin) — shown as "Support". */
  authorIsAdmin?: boolean;
  createdAt: string;
}

export async function getMyTickets(): Promise<Ticket[]> {
  const { data } = await axios.get<{ tickets: Ticket[] }>(
      `${DRUPAL_BASE}/api/me/tickets`,
      { headers: { Accept: 'application/json', ...authHeader() } },
  );
  return Array.isArray(data?.tickets) ? data.tickets : [];
}

export async function getTicket(nid: number): Promise<{ ticket: Ticket; messages: TicketMessage[] }> {
  const { data } = await axios.get(
      `${DRUPAL_BASE}/api/me/tickets/${nid}`,
      { headers: { Accept: 'application/json', ...authHeader() } },
  );
  return { ticket: data.ticket, messages: Array.isArray(data.messages) ? data.messages : [] };
}

export async function createTicket(input: {
  title: string;
  body: string;
  kind?: TicketKind;
  tourNid?: number;
}): Promise<Ticket> {
  const { data } = await axios.post<{ ticket: Ticket }>(
      `${DRUPAL_BASE}/api/me/tickets`,
      input,
      { headers: { Accept: 'application/json', ...authHeader() } },
  );
  return data.ticket;
}

/** Throws { code: 'resolved' } (via err.response.data.code) if the ticket is closed. */
export async function addTicketMessage(nid: number, body: string): Promise<void> {
  await axios.post(
      `${DRUPAL_BASE}/api/me/tickets/${nid}/messages`,
      { body },
      { headers: { Accept: 'application/json', ...authHeader() } },
  );
}

export async function getTicketsUnread(): Promise<{ messages: number; tickets: number }> {
  const { data } = await axios.get<{ messages: number; tickets: number }>(
      `${DRUPAL_BASE}/api/me/tickets/unread-count`,
      { headers: { Accept: 'application/json', ...authHeader() } },
  );
  return { messages: data?.messages ?? 0, tickets: data?.tickets ?? 0 };
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export type TicketStatusFilter = 'all' | 'open' | 'resolved';

export async function getAdminTickets(status: TicketStatusFilter = 'all'): Promise<Ticket[]> {
  const { data } = await axios.get<{ tickets: Ticket[] }>(
      `${DRUPAL_BASE}/api/admin/tickets?status=${status}`,
      { headers: { Accept: 'application/json', ...authHeader() } },
  );
  return Array.isArray(data?.tickets) ? data.tickets : [];
}

export async function getAdminTicket(nid: number): Promise<{ ticket: Ticket; messages: TicketMessage[] }> {
  const { data } = await axios.get(
      `${DRUPAL_BASE}/api/admin/tickets/${nid}`,
      { headers: { Accept: 'application/json', ...authHeader() } },
  );
  return { ticket: data.ticket, messages: Array.isArray(data.messages) ? data.messages : [] };
}

export async function adminReplyTicket(nid: number, body: string): Promise<void> {
  await axios.post(
      `${DRUPAL_BASE}/api/admin/tickets/${nid}/messages`,
      { body },
      { headers: { Accept: 'application/json', ...authHeader() } },
  );
}

export async function adminResolveTicket(nid: number): Promise<void> {
  await axios.post(
      `${DRUPAL_BASE}/api/admin/tickets/${nid}/resolve`,
      {},
      { headers: { Accept: 'application/json', ...authHeader() } },
  );
}

export async function getAdminTicketsUnread(): Promise<{ messages: number; tickets: number }> {
  const { data } = await axios.get<{ messages: number; tickets: number }>(
      `${DRUPAL_BASE}/api/admin/tickets/unread-count`,
      { headers: { Accept: 'application/json', ...authHeader() } },
  );
  return { messages: data?.messages ?? 0, tickets: data?.tickets ?? 0 };
}
