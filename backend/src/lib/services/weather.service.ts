import { randomUUID } from 'crypto';
import type {
  Container, WeatherData, WeatherAlert, WeatherActivity,
  WeatherCondition, AlertType, AlertSeverity, ActivityCategory, DifficultyLevel,
} from '../container/types';
import type { InMemoryWeatherRepository } from '../repositories/weather.repository.memory';

const CONDITIONS: WeatherCondition[] = ['sunny', 'partly_cloudy', 'cloudy', 'rainy', 'stormy', 'foggy', 'windy', 'snowy'];
const ALERT_TYPES: AlertType[] = ['warning', 'watch', 'advisory', 'statement'];
const ALERT_SEVERITIES: AlertSeverity[] = ['minor', 'moderate', 'severe', 'extreme'];
const ACTIVITY_CATEGORIES: ActivityCategory[] = ['outdoor', 'indoor', 'water', 'sports', 'relaxation', 'cultural'];
const DIFFICULTY_LEVELS: DifficultyLevel[] = ['easy', 'moderate', 'challenging'];
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'];

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}
function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

type Result<T> = { success: true; data: T } | { success: false; error: string };
function ok<T>(data: T): Result<T> { return { success: true, data }; }
function fail<T>(error: string): Result<T> { return { success: false, error }; }

export function createWeatherService(container: Container) {
  const repo = container.weatherRepository as InMemoryWeatherRepository;

  return {
    // ─── Record / CRUD ───────────────────────────────────────────────────────
    async recordWeather(input: {
      location: string; date: string; condition: string;
      temperatureHigh: number; temperatureLow: number; temperatureCurrent: number;
      humidity: number; windSpeed: number;
      windDirection?: string; uvIndex?: number; precipitation?: number;
      visibility?: number; sunrise?: string; sunset?: string;
    }): Promise<Result<WeatherData>> {
      if (!input.location?.trim()) return fail('Location is required');
      if (!isValidDate(input.date)) return fail('Invalid date format');
      if (!CONDITIONS.includes(input.condition as WeatherCondition)) return fail(`Invalid condition: ${input.condition}`);
      if (input.temperatureHigh < input.temperatureLow) return fail('High temperature cannot be lower than low temperature');
      if (input.temperatureCurrent < input.temperatureLow || input.temperatureCurrent > input.temperatureHigh) return fail('Current temperature must be between low and high');
      if (input.humidity < 0 || input.humidity > 100) return fail('Humidity must be between 0 and 100');
      if (input.windSpeed < 0) return fail('Wind speed must be non-negative');
      if (input.uvIndex !== undefined && (input.uvIndex < 0 || input.uvIndex > 15)) return fail('UV index must be between 0 and 15');
      if (input.precipitation !== undefined && input.precipitation < 0) return fail('Precipitation cannot be negative');
      if (input.visibility !== undefined && input.visibility < 0) return fail('Visibility cannot be negative');

      const data: WeatherData = {
        id: randomUUID(),
        location: input.location.trim(),
        date: input.date,
        condition: input.condition as WeatherCondition,
        temperatureHigh: input.temperatureHigh,
        temperatureLow: input.temperatureLow,
        temperatureCurrent: input.temperatureCurrent,
        humidity: input.humidity,
        windSpeed: input.windSpeed,
        windDirection: input.windDirection ?? null,
        uvIndex: input.uvIndex ?? null,
        precipitation: input.precipitation ?? null,
        visibility: input.visibility ?? null,
        sunrise: input.sunrise ?? null,
        sunset: input.sunset ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      return ok(await repo.saveWeather(data));
    },

    async getCurrentWeather(location: string): Promise<Result<WeatherData>> {
      if (!location?.trim()) return fail('Location is required');
      const data = await repo.findWeatherByLocation(location.trim());
      if (!data) return fail('No weather data found for location');
      return ok(data);
    },

    async updateWeather(id: string, updates: Partial<{ condition: string; temperatureCurrent: number; humidity: number; windSpeed: number }>): Promise<Result<WeatherData>> {
      if (!isUUID(id)) return fail('Invalid weather ID');
      const existing = await repo.findWeatherById(id);
      if (!existing) return fail('Weather record not found');
      if (updates.condition !== undefined && !CONDITIONS.includes(updates.condition as WeatherCondition)) {
        return fail(`Invalid condition: ${updates.condition}`);
      }
      const updated: WeatherData = {
        ...existing,
        condition: updates.condition !== undefined ? (updates.condition as WeatherCondition) : existing.condition,
        temperatureCurrent: updates.temperatureCurrent ?? existing.temperatureCurrent,
        humidity: updates.humidity ?? existing.humidity,
        windSpeed: updates.windSpeed ?? existing.windSpeed,
        updatedAt: new Date().toISOString(),
      };
      return ok(await repo.saveWeather(updated));
    },

    async getWeatherHistory(location: string, startDate: string, endDate: string): Promise<Result<WeatherData[]>> {
      if (!location?.trim()) return fail('Location is required');
      if (!isValidDate(startDate)) return fail('Invalid start date');
      if (!isValidDate(endDate)) return fail('Invalid end date');
      if (endDate < startDate) return fail('End date cannot be before start date');
      return ok(await repo.findWeatherHistory(location.trim(), startDate, endDate));
    },

    // ─── Alerts ──────────────────────────────────────────────────────────────
    async createAlert(input: {
      type: string; severity: string; title: string; description: string;
      location: string; startTime: string; endTime: string;
    }): Promise<Result<WeatherAlert>> {
      if (!ALERT_TYPES.includes(input.type as AlertType)) return fail(`Invalid alert type: ${input.type}`);
      if (!ALERT_SEVERITIES.includes(input.severity as AlertSeverity)) return fail(`Invalid severity: ${input.severity}`);
      if (!input.title?.trim()) return fail('Title is required');
      if (!input.description?.trim()) return fail('Description is required');
      if (!input.location?.trim()) return fail('Location is required');
      if (new Date(input.endTime) <= new Date(input.startTime)) return fail('End time must be after start time');

      const alert: WeatherAlert = {
        id: randomUUID(),
        type: input.type as AlertType,
        severity: input.severity as AlertSeverity,
        title: input.title.trim(),
        description: input.description.trim(),
        location: input.location.trim(),
        startTime: input.startTime,
        endTime: input.endTime,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      return ok(await repo.saveAlert(alert));
    },

    async getAlerts(location: string): Promise<Result<WeatherAlert[]>> {
      if (!location?.trim()) return fail('Location is required');
      return ok(await repo.findAlertsByLocation(location.trim()));
    },

    async deactivateAlert(id: string): Promise<Result<WeatherAlert>> {
      if (!isUUID(id)) return fail('Invalid alert ID');
      const alert = await repo.findAlertById(id);
      if (!alert) return fail('Alert not found');
      const updated = { ...alert, isActive: false };
      return ok(await repo.saveAlert(updated));
    },

    async deleteAlert(id: string): Promise<Result<void>> {
      if (!isUUID(id)) return fail('Invalid alert ID');
      const alert = await repo.findAlertById(id);
      if (!alert) return fail('Alert not found');
      await repo.deleteAlert(id);
      return ok(undefined);
    },

    // ─── Activities ──────────────────────────────────────────────────────────
    async createActivity(input: {
      name: string; description: string; category: string;
      suitableConditions: string[]; minTemperature?: number; maxTemperature?: number;
      maxWindSpeed?: number; maxPrecipitation?: number; duration?: number; difficulty?: string;
    }): Promise<Result<WeatherActivity>> {
      if (!input.name?.trim()) return fail('Name is required');
      if (!input.description?.trim()) return fail('Description is required');
      if (!ACTIVITY_CATEGORIES.includes(input.category as ActivityCategory)) return fail(`Invalid category: ${input.category}`);
      if (!input.suitableConditions || input.suitableConditions.length === 0) return fail('At least one suitable condition is required');
      for (const c of input.suitableConditions) {
        if (!CONDITIONS.includes(c as WeatherCondition)) return fail(`Invalid condition: ${c}`);
      }
      if (input.difficulty !== undefined && !DIFFICULTY_LEVELS.includes(input.difficulty as DifficultyLevel)) return fail(`Invalid difficulty: ${input.difficulty}`);
      if (input.duration !== undefined && input.duration <= 0) return fail('Duration must be positive');
      if (input.minTemperature !== undefined && input.maxTemperature !== undefined && input.minTemperature > input.maxTemperature) return fail('Min temperature cannot be greater than max temperature');
      if (input.maxWindSpeed !== undefined && input.maxWindSpeed < 0) return fail('Max wind speed must be non-negative');
      if (input.maxPrecipitation !== undefined && input.maxPrecipitation < 0) return fail('Max precipitation must be non-negative');

      const activity: WeatherActivity = {
        id: randomUUID(),
        name: input.name.trim(),
        description: input.description.trim(),
        category: input.category as ActivityCategory,
        suitableConditions: input.suitableConditions as WeatherCondition[],
        minTemperature: input.minTemperature ?? null,
        maxTemperature: input.maxTemperature ?? null,
        maxWindSpeed: input.maxWindSpeed ?? null,
        maxPrecipitation: input.maxPrecipitation ?? null,
        duration: input.duration ?? null,
        difficulty: (input.difficulty as DifficultyLevel) ?? null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };
      return ok(await repo.saveActivity(activity));
    },

    async getActivity(id: string): Promise<Result<WeatherActivity>> {
      if (!isUUID(id)) return fail('Invalid activity ID');
      const a = await repo.findActivityById(id);
      if (!a) return fail('Activity not found');
      return ok(a);
    },

    async updateActivity(id: string, updates: Partial<{ name: string; isActive: boolean; suitableConditions: string[] }>): Promise<Result<WeatherActivity>> {
      if (!isUUID(id)) return fail('Invalid activity ID');
      const a = await repo.findActivityById(id);
      if (!a) return fail('Activity not found');
      if (updates.name !== undefined && !updates.name.trim()) return fail('Name cannot be empty');
      if (updates.suitableConditions !== undefined) {
        if (updates.suitableConditions.length === 0) return fail('At least one suitable condition is required');
        for (const c of updates.suitableConditions) {
          if (!CONDITIONS.includes(c as WeatherCondition)) return fail(`Invalid condition: ${c}`);
        }
      }
      const updated: WeatherActivity = {
        ...a,
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
        ...(updates.suitableConditions !== undefined ? { suitableConditions: updates.suitableConditions as WeatherCondition[] } : {}),
        updatedAt: new Date().toISOString(),
      };
      return ok(await repo.saveActivity(updated));
    },

    async deleteActivity(id: string): Promise<Result<void>> {
      if (!isUUID(id)) return fail('Invalid activity ID');
      const a = await repo.findActivityById(id);
      if (!a) return fail('Activity not found');
      await repo.deleteActivity(id);
      return ok(undefined);
    },

    async getRecommendedActivities(location: string): Promise<Result<WeatherActivity[]>> {
      if (!location?.trim()) return fail('Location is required');
      const weather = await repo.findWeatherByLocation(location.trim());
      if (!weather) return fail('No weather data available for recommendations');
      const all = await repo.findAllActivities();
      const matches = all.filter(a => {
        if (!a.isActive) return false;
        if (!a.suitableConditions.includes(weather.condition)) return false;
        if (a.minTemperature !== null && weather.temperatureCurrent < a.minTemperature) return false;
        if (a.maxTemperature !== null && weather.temperatureCurrent > a.maxTemperature) return false;
        if (a.maxWindSpeed !== null && weather.windSpeed > a.maxWindSpeed) return false;
        if (a.maxPrecipitation !== null && weather.precipitation !== null && weather.precipitation > a.maxPrecipitation) return false;
        return true;
      });
      return ok(matches);
    },

    // ─── Calculations ─────────────────────────────────────────────────────────
    calculateHeatIndex(tempC: number, humidity: number): number {
      if (tempC < 27 || humidity < 40) return tempC;
      // Simplified Rothfusz regression (°C)
      const T = tempC, H = humidity;
      const hi = -8.78469475556 + 1.61139411 * T + 2.33854883889 * H
        - 0.14611605 * T * H - 0.012308094 * T * T
        - 0.0164248277778 * H * H + 0.002211732 * T * T * H
        + 0.00072546 * T * H * H - 0.000003582 * T * T * H * H;
      return Math.round(hi * 10) / 10;
    },

    calculateWindChill(tempC: number, windKmh: number): number {
      if (tempC >= 10 || windKmh < 4.8) return tempC;
      const wc = 13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * tempC * Math.pow(windKmh, 0.16);
      return Math.round(wc * 10) / 10;
    },

    calculateFeelsLike(tempC: number, humidity: number, windKmh: number): number {
      if (tempC >= 27 && humidity >= 40) {
        // use heat index logic
        const T = tempC, H = humidity;
        if (tempC < 27 || humidity < 40) return tempC;
        const hi = -8.78469475556 + 1.61139411 * T + 2.33854883889 * H
          - 0.14611605 * T * H - 0.012308094 * T * T
          - 0.0164248277778 * H * H + 0.002211732 * T * T * H
          + 0.00072546 * T * H * H - 0.000003582 * T * T * H * H;
        return Math.round(hi * 10) / 10;
      }
      if (tempC < 10 && windKmh >= 4.8) {
        const wc = 13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * tempC * Math.pow(windKmh, 0.16);
        return Math.round(wc * 10) / 10;
      }
      return tempC;
    },

    getUVRiskLevel(uv: number): string {
      if (uv <= 2) return 'Low';
      if (uv <= 5) return 'Moderate';
      if (uv <= 7) return 'High';
      if (uv <= 10) return 'Very High';
      return 'Extreme';
    },

    getSunProtectionAdvice(uv: number): string[] {
      if (uv <= 2) return ['Minimal protection required'];
      if (uv <= 5) return ['Wear sunscreen SPF 30+', 'Wear a hat'];
      if (uv <= 7) return ['Apply sunscreen SPF 50+', 'Wear protective clothing', 'Seek shade during midday'];
      if (uv <= 10) return ['Apply sunscreen SPF 50+ frequently', 'Wear UV-blocking sunglasses', 'Cover up and seek shade', 'Limit midday sun exposure'];
      return ['Avoid sun exposure during midday', 'Apply sunscreen SPF 50+ every 2 hours', 'Wear full protective clothing', 'UV-protective sunglasses required', 'Stay in shade as much as possible'];
    },

    isGoodBeachDay(weather: WeatherData): boolean {
      return ['sunny', 'partly_cloudy'].includes(weather.condition)
        && weather.temperatureCurrent >= 24
        && weather.windSpeed <= 20
        && (weather.precipitation ?? 0) === 0;
    },

    isGoodPoolDay(weather: WeatherData): boolean {
      return !['stormy', 'rainy'].includes(weather.condition)
        && weather.temperatureCurrent >= 22
        && weather.windSpeed <= 30
        && (weather.precipitation ?? 0) < 5;
    },

    isGoodHikingDay(weather: WeatherData): boolean {
      return !['foggy', 'stormy', 'snowy'].includes(weather.condition)
        && (weather.visibility === null || weather.visibility >= 5)
        && weather.windSpeed <= 40
        && (weather.precipitation ?? 0) < 10;
    },

    // ─── Utilities ────────────────────────────────────────────────────────────
    getWeatherConditions(): WeatherCondition[] { return [...CONDITIONS]; },
    getActivityCategories(): ActivityCategory[] { return [...ACTIVITY_CATEGORIES]; },
    getDifficultyLevels(): DifficultyLevel[] { return [...DIFFICULTY_LEVELS]; },

    formatTemperature(tempC: number, unit: 'C' | 'F' = 'C'): string {
      if (unit === 'F') return `${Math.round(tempC * 9 / 5 + 32)}°F`;
      return `${tempC}°C`;
    },

    formatWindSpeed(kmh: number, unit: 'km/h' | 'mph' | 'knots' = 'km/h'): string {
      if (unit === 'mph') return `${Math.round(kmh * 0.621371)} mph`;
      if (unit === 'knots') return `${Math.round(kmh * 0.539957)} knots`;
      return `${kmh} km/h`;
    },

    getWeatherIcon(condition: WeatherCondition): string {
      const icons: Record<WeatherCondition, string> = {
        sunny: '☀️', partly_cloudy: '⛅', cloudy: '☁️', rainy: '🌧️',
        stormy: '⛈️', foggy: '🌫️', windy: '💨', snowy: '❄️',
      };
      return icons[condition];
    },

    getWeatherDescription(condition: WeatherCondition): string {
      const desc: Record<WeatherCondition, string> = {
        sunny: 'Clear skies with bright sunshine',
        partly_cloudy: 'Mix of sun and clouds',
        cloudy: 'Overcast with heavy cloud cover',
        rainy: 'Expect rain showers throughout the day',
        stormy: 'Severe storm conditions with lightning',
        foggy: 'Low visibility due to dense fog',
        windy: 'Strong winds expected throughout the day',
        snowy: 'Snow expected — dress warmly',
      };
      return desc[condition];
    },
  };
}
