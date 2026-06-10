// services/weather.service.ts
// Weather for a tour's location via Open-Meteo (free, no API key, CORS-enabled).
// Used by the tour detail page. Direct external call (like Stripe.js / Google),
// NOT through drupal-client / BASE_URL.

import axios from 'axios';
import { cached } from '../lib/mem-cache';

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_TTL = 30 * 60 * 1000; // 30 min — weather changes slowly.
const REQUEST_TIMEOUT = 8000;

// Dedicated client: a request interceptor on the GLOBAL axios instance
// (lib/drupal-client.ts) adds an `ngrok-skip-browser-warning` header to every
// default-axios call when behind a ngrok tunnel. That header triggers a CORS
// preflight that Open-Meteo rejects. A separate instance has its own (empty)
// interceptor stack, so the header is never attached here.
const weatherClient = axios.create();

export interface WeatherHour {
  /** Localized ISO string from the API, e.g. '2026-06-10T14:00'. */
  time: string;
  temp: number;
  code: number;
  precipitationProbability: number;
}

export interface WeatherCurrent {
  /** Localized ISO string from the API, e.g. '2026-06-10T14:15'. */
  time: string;
  temp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  code: number;
  isDay: boolean;
}

export interface WeatherDay {
  /** Local date string from the API, e.g. '2026-06-11'. */
  date: string;
  code: number;
  tempMax: number;
  tempMin: number;
  precipitationProbabilityMax: number;
}

export interface WeatherData {
  current: WeatherCurrent;
  hourly: WeatherHour[];
  daily: WeatherDay[];
  timezone: string;
}

/**
 * Fetches current + hourly weather for a coordinate. Cached in memory (30 min)
 * keyed by rounded coordinates so nearby tours share an entry.
 */
export async function getWeather(lat: number, lon: number): Promise<WeatherData> {
  const key = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  return cached(key, WEATHER_TTL, () => fetchWeather(lat, lon));
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const { data } = await weatherClient.get(ENDPOINT, {
    timeout: REQUEST_TIMEOUT,
    params: {
      latitude: lat,
      longitude: lon,
      current:
        'temperature_2m,weather_code,is_day,apparent_temperature,relative_humidity_2m,wind_speed_10m',
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: 7,
      timezone: 'auto',
    },
  });

  const cur = data.current ?? {};
  const h = data.hourly ?? {};
  const times: string[] = h.time ?? [];
  const temps: number[] = h.temperature_2m ?? [];
  const codes: number[] = h.weather_code ?? [];
  const precs: number[] = h.precipitation_probability ?? [];

  const hourly: WeatherHour[] = times.map((time, i) => ({
    time,
    temp: Math.round(temps[i] ?? 0),
    code: codes[i] ?? 0,
    precipitationProbability: precs[i] ?? 0,
  }));

  const d = data.daily ?? {};
  const dDates: string[] = d.time ?? [];
  const dCodes: number[] = d.weather_code ?? [];
  const dMax: number[] = d.temperature_2m_max ?? [];
  const dMin: number[] = d.temperature_2m_min ?? [];
  const dPrec: number[] = d.precipitation_probability_max ?? [];

  const daily: WeatherDay[] = dDates.map((date, i) => ({
    date,
    code: dCodes[i] ?? 0,
    tempMax: Math.round(dMax[i] ?? 0),
    tempMin: Math.round(dMin[i] ?? 0),
    precipitationProbabilityMax: dPrec[i] ?? 0,
  }));

  return {
    current: {
      time: cur.time ?? '',
      temp: Math.round(cur.temperature_2m ?? 0),
      apparentTemp: Math.round(cur.apparent_temperature ?? 0),
      humidity: Math.round(cur.relative_humidity_2m ?? 0),
      windSpeed: Math.round(cur.wind_speed_10m ?? 0),
      code: cur.weather_code ?? 0,
      isDay: (cur.is_day ?? 1) === 1,
    },
    hourly,
    daily,
    timezone: data.timezone ?? 'auto',
  };
}
