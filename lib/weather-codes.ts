// lib/weather-codes.ts
// WMO weather_code (0-99, as returned by Open-Meteo) → icon + i18n label + colour.
// Pure mapping, no React. See https://open-meteo.com/en/docs (WMO Weather interpretation codes).

export interface WeatherCondition {
  /** Ionicons name for daytime. */
  iconDay: string;
  /** Ionicons name for nighttime. */
  iconNight: string;
  /** i18n key, e.g. 'weather.cond.clear'. */
  labelKey: string;
  /** Accent colour for the icon. */
  color: string;
}

const CLEAR: WeatherCondition       = { iconDay: 'sunny',        iconNight: 'moon',          labelKey: 'weather.cond.clear',        color: '#F59E0B' };
const PARTLY: WeatherCondition      = { iconDay: 'partly-sunny', iconNight: 'cloudy-night',  labelKey: 'weather.cond.partly',       color: '#FBBF24' };
const OVERCAST: WeatherCondition    = { iconDay: 'cloudy',       iconNight: 'cloudy',        labelKey: 'weather.cond.overcast',     color: '#9CA3AF' };
const FOG: WeatherCondition         = { iconDay: 'cloudy',       iconNight: 'cloudy',        labelKey: 'weather.cond.fog',          color: '#9CA3AF' };
const DRIZZLE: WeatherCondition     = { iconDay: 'rainy',        iconNight: 'rainy',         labelKey: 'weather.cond.drizzle',      color: '#3B82F6' };
const RAIN: WeatherCondition        = { iconDay: 'rainy',        iconNight: 'rainy',         labelKey: 'weather.cond.rain',         color: '#3B82F6' };
const SNOW: WeatherCondition        = { iconDay: 'snow',         iconNight: 'snow',          labelKey: 'weather.cond.snow',         color: '#93C5FD' };
const SHOWERS: WeatherCondition     = { iconDay: 'rainy',        iconNight: 'rainy',         labelKey: 'weather.cond.showers',      color: '#3B82F6' };
const THUNDERSTORM: WeatherCondition = { iconDay: 'thunderstorm', iconNight: 'thunderstorm', labelKey: 'weather.cond.thunderstorm', color: '#6366F1' };

const CODE_MAP: Record<number, WeatherCondition> = {
  0: CLEAR,
  1: PARTLY, 2: PARTLY,
  3: OVERCAST,
  45: FOG, 48: FOG,
  51: DRIZZLE, 53: DRIZZLE, 55: DRIZZLE, 56: DRIZZLE, 57: DRIZZLE,
  61: RAIN, 63: RAIN, 65: RAIN, 66: RAIN, 67: RAIN,
  71: SNOW, 73: SNOW, 75: SNOW, 77: SNOW,
  80: SHOWERS, 81: SHOWERS, 82: SHOWERS,
  85: SNOW, 86: SNOW,
  95: THUNDERSTORM, 96: THUNDERSTORM, 99: THUNDERSTORM,
};

/** Returns the condition descriptor for a WMO code (fallback: overcast). */
export function getCondition(code: number): WeatherCondition {
  return CODE_MAP[code] ?? OVERCAST;
}

/** Returns the Ionicons name for a code, picking the day or night variant. */
export function resolveIcon(code: number, isDay: boolean): string {
  const cond = getCondition(code);
  return isDay ? cond.iconDay : cond.iconNight;
}
