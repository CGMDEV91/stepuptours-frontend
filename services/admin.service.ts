import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function getAuthHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  return { Authorization: `Basic ${session.token}` };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SocialLink {
  url: string;
  visible: boolean;
}

export interface SocialLinksConfig {
  facebook: SocialLink;
  twitter: SocialLink;
  instagram: SocialLink;
}

export interface StripeSettings {
  publishableKey: string;
  secretKeyConfigured: boolean;
  webhookConfigured: boolean;
}

export interface SiteSettings {
  siteName: string;
  siteEmail: string;
  slogan: string;
  address: string;
  phone: string;
  socialLinks: SocialLinksConfig;
  stripeSettings?: StripeSettings;
  paymentSettings?: {
    platformRevenuePercentage: number;
    stripeConfigured: boolean;
  };
}

export interface StripeKeysInput {
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}

export interface TranslationRow {
  key: string;
  source: string;
  target: string;
}

export interface AdminLanguage {
  id: string;
  label: string;
}

// ── Drupal API ────────────────────────────────────────────────────────────────

export async function getSiteSettings(): Promise<SiteSettings> {
  const { data } = await axios.get(`${BASE_URL}/api/site-settings`);
  return data;
}

export async function updateSiteSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
  const { data } = await axios.put(`${BASE_URL}/api/site-settings`, settings, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
  });
  return data;
}

export async function getAdminLanguages(): Promise<AdminLanguage[]> {
  const { data } = await axios.get(`${BASE_URL}/api/admin/languages`);
  return data;
}

export async function updateStripeKeys(keys: StripeKeysInput): Promise<SiteSettings> {
  const { data } = await axios.put(
      `${BASE_URL}/api/site-settings`,
      { stripeSettings: keys },
      { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
  return data;
}

// ── Translations (i18next + AsyncStorage) ─────────────────────────────────────

const TRANSLATIONS_KEY = (lang: string) => `admin:translations:${lang}`;

export async function getTranslations(langcode: string): Promise<TranslationRow[]> {
  // Base: i18next bundle for this language
  const base: Record<string, string> =
      i18next.getResourceBundle(langcode, 'translation') ?? {};

  // Overrides saved by admin in AsyncStorage
  let overrides: Record<string, string> = {};
  try {
    const raw = await AsyncStorage.getItem(TRANSLATIONS_KEY(langcode));
    if (raw) overrides = JSON.parse(raw);
  } catch {}

  // English is always the source
  const source: Record<string, string> =
      i18next.getResourceBundle('en', 'translation') ?? {};

  return Object.keys(source).map((key) => ({
    key,
    source: source[key] ?? '',
    target: overrides[key] ?? base[key] ?? '',
  }));
}

export async function saveTranslations(
    langcode: string,
    translations: { key: string; value: string }[],
): Promise<void> {
  // Load existing overrides
  let overrides: Record<string, string> = {};
  try {
    const raw = await AsyncStorage.getItem(TRANSLATIONS_KEY(langcode));
    if (raw) overrides = JSON.parse(raw);
  } catch {}

  // Merge new values
  translations.forEach(({ key, value }) => {
    overrides[key] = value;
  });

  // Persist to AsyncStorage
  await AsyncStorage.setItem(TRANSLATIONS_KEY(langcode), JSON.stringify(overrides));

  // Apply to i18next in-memory so UI updates immediately
  const bundle: Record<string, string> = {};
  translations.forEach(({ key, value }) => { bundle[key] = value; });
  i18next.addResourceBundle(langcode, 'translation', bundle, true, true);
}

// ── Social Links (AsyncStorage) ───────────────────────────────────────────────

const SOCIAL_LINKS_KEY = 'admin:socialLinks';

export async function getSocialLinks(): Promise<SocialLinksConfig> {
  try {
    const raw = await AsyncStorage.getItem(SOCIAL_LINKS_KEY);
    if (raw) return JSON.parse(raw) as SocialLinksConfig;
  } catch {}
  return {
    facebook:  { url: '', visible: false },
    twitter:   { url: '', visible: false },
    instagram: { url: '', visible: false },
  };
}

export async function saveSocialLinks(links: SocialLinksConfig): Promise<void> {
  await AsyncStorage.setItem(SOCIAL_LINKS_KEY, JSON.stringify(links));
}