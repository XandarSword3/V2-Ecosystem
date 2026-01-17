/**
 * Weather Service
 * 
 * Provides weather data, forecasts, alerts, and activity recommendations
 * for resort guests. Supports multiple locations, weather history, and
 * smart activity suggestions based on current conditions.
 */

import type { 
  Container,
  WeatherRepository,
  WeatherData,
  WeatherAlert,
  WeatherForecast,
  ActivityRecommendation,
  WeatherCondition,
} from '../container/types';

// ============================================
// TYPES
// ============================================

export interface RecordWeatherInput {
  location: string;
  date: string;
  condition: string;
  temperatureHigh: number;
  temperatureLow: number;
  temperatureCurrent: number;
  humidity: number;
  windSpeed: number;
  windDirection?: string;
  uvIndex?: number;
  precipitation?: number;
  visibility?: number;
  sunrise?: string;
  sunset?: string;
}

export interface UpdateWeatherInput {
  condition?: string;
  temperatureHigh?: number;
  temperatureLow?: number;
  temperatureCurrent?: number;
  humidity?: number;
  windSpeed?: number;
  windDirection?: string;
  uvIndex?: number;
  precipitation?: number;
  visibility?: number;
}

export interface CreateAlertInput {
  type: string;
  severity: string;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
}

export interface CreateActivityInput {
  name: string;
  description: string;
  category: string;
  suitableConditions: string[];
  minTemperature?: number;
  maxTemperature?: number;
  maxWindSpeed?: number;
  maxPrecipitation?: number;
  duration?: number;
  difficulty?: string;
}

export interface UpdateActivityInput {
  name?: string;
  description?: string;
  category?: string;
  suitableConditions?: string[];
  minTemperature?: number;
  maxTemperature?: number;
  maxWindSpeed?: number;
  maxPrecipitation?: number;
  duration?: number;
  difficulty?: string;
  isActive?: boolean;
}

export interface WeatherServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// VALIDATION
// ============================================

const WEATHER_CONDITIONS: WeatherCondition[] = [
  'sunny', 'partly_cloudy', 'cloudy', 'rainy', 'stormy', 'snowy', 'foggy', 'windy'
];

const ALERT_TYPES = ['warning', 'watch', 'advisory'] as const;
const ALERT_SEVERITIES = ['minor', 'moderate', 'severe', 'extreme'] as const;
const ACTIVITY_CATEGORIES = ['outdoor', 'indoor', 'water', 'sports', 'relaxation', 'dining'] as const;
const DIFFICULTY_LEVELS = ['easy', 'moderate', 'challenging'] as const;
const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_PATTERN.test(id);
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isValidCondition(condition: string): condition is WeatherCondition {
  return WEATHER_CONDITIONS.includes(condition as WeatherCondition);
}

function isValidAlertType(type: string): boolean {
  return ALERT_TYPES.includes(type as typeof ALERT_TYPES[number]);
}

function isValidSeverity(severity: string): boolean {
  return ALERT_SEVERITIES.includes(severity as typeof ALERT_SEVERITIES[number]);
}

function isValidCategory(category: string): boolean {
  return ACTIVITY_CATEGORIES.includes(category as typeof ACTIVITY_CATEGORIES[number]);
}

function isValidDifficulty(difficulty: string): boolean {
  return DIFFICULTY_LEVELS.includes(difficulty as typeof DIFFICULTY_LEVELS[number]);
}

// ============================================
// SERVICE FACTORY
// ============================================

export function createWeatherService(container: Container) {
  const { weatherRepository } = container;

  // ============================================
  // WEATHER DATA OPERATIONS
  // ============================================

  async function recordWeather(input: RecordWeatherInput): Promise<WeatherServiceResult<WeatherData>> {
    // Validate location
    if (!input.location || input.location.trim() === '') {
      return { success: false, error: 'Location is required' };
    }

    // Validate date
    if (!isValidDate(input.date)) {
      return { success: false, error: 'Invalid date format' };
    }

    // Validate condition
    if (!isValidCondition(input.condition)) {
      return { success: false, error: `Invalid condition. Must be one of: ${WEATHER_CONDITIONS.join(', ')}` };
    }

    // Validate temperature
    if (typeof input.temperatureHigh !== 'number' || typeof input.temperatureLow !== 'number') {
      return { success: false, error: 'Temperature high and low are required' };
    }

    if (input.temperatureHigh < input.temperatureLow) {
      return { success: false, error: 'High temperature cannot be lower than low temperature' };
    }

    if (input.temperatureCurrent < input.temperatureLow || input.temperatureCurrent > input.temperatureHigh) {
      return { success: false, error: 'Current temperature must be between low and high' };
    }

    // Validate humidity
    if (typeof input.humidity !== 'number' || input.humidity < 0 || input.humidity > 100) {
      return { success: false, error: 'Humidity must be between 0 and 100' };
    }

    // Validate wind speed
    if (typeof input.windSpeed !== 'number' || input.windSpeed < 0) {
      return { success: false, error: 'Wind speed must be non-negative' };
    }

    // Validate UV index if provided
    if (input.uvIndex !== undefined && (input.uvIndex < 0 || input.uvIndex > 15)) {
      return { success: false, error: 'UV index must be between 0 and 15' };
    }

    // Validate precipitation if provided
    if (input.precipitation !== undefined && input.precipitation < 0) {
      return { success: false, error: 'Precipitation cannot be negative' };
    }

    // Validate visibility if provided
    if (input.visibility !== undefined && input.visibility < 0) {
      return { success: false, error: 'Visibility cannot be negative' };
    }

    const weather = await weatherRepository.saveWeather({
      location: input.location.trim(),
      date: input.date,
      condition: input.condition as WeatherCondition,
      temperatureHigh: input.temperatureHigh,
      temperatureLow: input.temperatureLow,
      temperatureCurrent: input.temperatureCurrent,
      humidity: input.humidity,
      windSpeed: input.windSpeed,
      windDirection: input.windDirection || 'N',
      uvIndex: input.uvIndex ?? 5,
      precipitation: input.precipitation ?? 0,
      visibility: input.visibility ?? 10,
      sunrise: input.sunrise || '06:00',
      sunset: input.sunset || '18:00',
    });

    return { success: true, data: weather };
  }

  async function getCurrentWeather(location: string): Promise<WeatherServiceResult<WeatherData>> {
    if (!location || location.trim() === '') {
      return { success: false, error: 'Location is required' };
    }

    const weather = await weatherRepository.getCurrentWeather(location.trim());
    
    if (!weather) {
      return { success: false, error: 'No weather data found for location' };
    }

    return { success: true, data: weather };
  }

  async function updateWeather(id: string, input: UpdateWeatherInput): Promise<WeatherServiceResult<WeatherData>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid weather ID' };
    }

    // Validate condition if provided
    if (input.condition !== undefined && !isValidCondition(input.condition)) {
      return { success: false, error: `Invalid condition. Must be one of: ${WEATHER_CONDITIONS.join(', ')}` };
    }

    // Validate humidity if provided
    if (input.humidity !== undefined && (input.humidity < 0 || input.humidity > 100)) {
      return { success: false, error: 'Humidity must be between 0 and 100' };
    }

    // Validate wind speed if provided
    if (input.windSpeed !== undefined && input.windSpeed < 0) {
      return { success: false, error: 'Wind speed must be non-negative' };
    }

    // Validate UV index if provided
    if (input.uvIndex !== undefined && (input.uvIndex < 0 || input.uvIndex > 15)) {
      return { success: false, error: 'UV index must be between 0 and 15' };
    }

    try {
      const updated = await weatherRepository.updateWeather(id, {
        ...input,
        condition: input.condition as WeatherCondition | undefined,
      });
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: 'Weather data not found' };
    }
  }

  async function getWeatherHistory(
    location: string, 
    startDate: string, 
    endDate: string
  ): Promise<WeatherServiceResult<WeatherData[]>> {
    if (!location || location.trim() === '') {
      return { success: false, error: 'Location is required' };
    }

    if (!isValidDate(startDate)) {
      return { success: false, error: 'Invalid start date' };
    }

    if (!isValidDate(endDate)) {
      return { success: false, error: 'Invalid end date' };
    }

    if (new Date(endDate) < new Date(startDate)) {
      return { success: false, error: 'End date cannot be before start date' };
    }

    const history = await weatherRepository.getWeatherHistory(location.trim(), startDate, endDate);
    return { success: true, data: history };
  }

  // ============================================
  // WEATHER ALERTS
  // ============================================

  async function createAlert(input: CreateAlertInput): Promise<WeatherServiceResult<WeatherAlert>> {
    // Validate type
    if (!isValidAlertType(input.type)) {
      return { success: false, error: `Invalid alert type. Must be one of: ${ALERT_TYPES.join(', ')}` };
    }

    // Validate severity
    if (!isValidSeverity(input.severity)) {
      return { success: false, error: `Invalid severity. Must be one of: ${ALERT_SEVERITIES.join(', ')}` };
    }

    // Validate title
    if (!input.title || input.title.trim() === '') {
      return { success: false, error: 'Title is required' };
    }

    // Validate description
    if (!input.description || input.description.trim() === '') {
      return { success: false, error: 'Description is required' };
    }

    // Validate location
    if (!input.location || input.location.trim() === '') {
      return { success: false, error: 'Location is required' };
    }

    // Validate times
    if (!isValidDate(input.startTime)) {
      return { success: false, error: 'Invalid start time' };
    }

    if (!isValidDate(input.endTime)) {
      return { success: false, error: 'Invalid end time' };
    }

    if (new Date(input.endTime) <= new Date(input.startTime)) {
      return { success: false, error: 'End time must be after start time' };
    }

    const alert = await weatherRepository.createAlert({
      type: input.type as 'warning' | 'watch' | 'advisory',
      severity: input.severity as 'minor' | 'moderate' | 'severe' | 'extreme',
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      isActive: true,
    });

    return { success: true, data: alert };
  }

  async function getAlerts(location: string): Promise<WeatherServiceResult<WeatherAlert[]>> {
    if (!location || location.trim() === '') {
      return { success: false, error: 'Location is required' };
    }

    const alerts = await weatherRepository.getAlerts(location.trim());
    return { success: true, data: alerts };
  }

  async function deactivateAlert(id: string): Promise<WeatherServiceResult<WeatherAlert>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid alert ID' };
    }

    try {
      const updated = await weatherRepository.updateAlert(id, { isActive: false });
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: 'Alert not found' };
    }
  }

  async function deleteAlert(id: string): Promise<WeatherServiceResult<void>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid alert ID' };
    }

    await weatherRepository.deleteAlert(id);
    return { success: true };
  }

  // ============================================
  // ACTIVITY RECOMMENDATIONS
  // ============================================

  async function createActivity(input: CreateActivityInput): Promise<WeatherServiceResult<ActivityRecommendation>> {
    // Validate name
    if (!input.name || input.name.trim() === '') {
      return { success: false, error: 'Name is required' };
    }

    // Validate description
    if (!input.description || input.description.trim() === '') {
      return { success: false, error: 'Description is required' };
    }

    // Validate category
    if (!isValidCategory(input.category)) {
      return { success: false, error: `Invalid category. Must be one of: ${ACTIVITY_CATEGORIES.join(', ')}` };
    }

    // Validate suitable conditions
    if (!input.suitableConditions || input.suitableConditions.length === 0) {
      return { success: false, error: 'At least one suitable condition is required' };
    }

    for (const cond of input.suitableConditions) {
      if (!isValidCondition(cond)) {
        return { success: false, error: `Invalid condition: ${cond}` };
      }
    }

    // Validate difficulty if provided
    if (input.difficulty !== undefined && !isValidDifficulty(input.difficulty)) {
      return { success: false, error: `Invalid difficulty. Must be one of: ${DIFFICULTY_LEVELS.join(', ')}` };
    }

    // Validate duration if provided
    if (input.duration !== undefined && input.duration <= 0) {
      return { success: false, error: 'Duration must be positive' };
    }

    // Validate temperature range
    const minTemp = input.minTemperature ?? -10;
    const maxTemp = input.maxTemperature ?? 40;
    if (minTemp > maxTemp) {
      return { success: false, error: 'Min temperature cannot be greater than max temperature' };
    }

    // Validate wind speed if provided
    if (input.maxWindSpeed !== undefined && input.maxWindSpeed < 0) {
      return { success: false, error: 'Max wind speed must be non-negative' };
    }

    // Validate precipitation if provided
    if (input.maxPrecipitation !== undefined && input.maxPrecipitation < 0) {
      return { success: false, error: 'Max precipitation must be non-negative' };
    }

    const activity = await weatherRepository.createActivity({
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category as 'outdoor' | 'indoor' | 'water' | 'sports' | 'relaxation' | 'dining',
      suitableConditions: input.suitableConditions as WeatherCondition[],
      minTemperature: minTemp,
      maxTemperature: maxTemp,
      maxWindSpeed: input.maxWindSpeed ?? 50,
      maxPrecipitation: input.maxPrecipitation ?? 10,
      duration: input.duration ?? 60,
      difficulty: (input.difficulty || 'easy') as 'easy' | 'moderate' | 'challenging',
      isActive: true,
    });

    return { success: true, data: activity };
  }

  async function getActivity(id: string): Promise<WeatherServiceResult<ActivityRecommendation>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid activity ID' };
    }

    const activity = await weatherRepository.getActivityById(id);
    
    if (!activity) {
      return { success: false, error: 'Activity not found' };
    }

    return { success: true, data: activity };
  }

  async function updateActivity(id: string, input: UpdateActivityInput): Promise<WeatherServiceResult<ActivityRecommendation>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid activity ID' };
    }

    // Validate name if provided
    if (input.name !== undefined && input.name.trim() === '') {
      return { success: false, error: 'Name cannot be empty' };
    }

    // Validate category if provided
    if (input.category !== undefined && !isValidCategory(input.category)) {
      return { success: false, error: `Invalid category. Must be one of: ${ACTIVITY_CATEGORIES.join(', ')}` };
    }

    // Validate conditions if provided
    if (input.suitableConditions !== undefined) {
      if (input.suitableConditions.length === 0) {
        return { success: false, error: 'At least one suitable condition is required' };
      }
      for (const cond of input.suitableConditions) {
        if (!isValidCondition(cond)) {
          return { success: false, error: `Invalid condition: ${cond}` };
        }
      }
    }

    // Validate difficulty if provided
    if (input.difficulty !== undefined && !isValidDifficulty(input.difficulty)) {
      return { success: false, error: `Invalid difficulty. Must be one of: ${DIFFICULTY_LEVELS.join(', ')}` };
    }

    // Validate duration if provided
    if (input.duration !== undefined && input.duration <= 0) {
      return { success: false, error: 'Duration must be positive' };
    }

    try {
      const updated = await weatherRepository.updateActivity(id, {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description.trim() }),
        ...(input.category !== undefined && { category: input.category as 'outdoor' | 'indoor' | 'water' | 'sports' | 'relaxation' | 'dining' }),
        ...(input.suitableConditions !== undefined && { suitableConditions: input.suitableConditions as WeatherCondition[] }),
        ...(input.minTemperature !== undefined && { minTemperature: input.minTemperature }),
        ...(input.maxTemperature !== undefined && { maxTemperature: input.maxTemperature }),
        ...(input.maxWindSpeed !== undefined && { maxWindSpeed: input.maxWindSpeed }),
        ...(input.maxPrecipitation !== undefined && { maxPrecipitation: input.maxPrecipitation }),
        ...(input.duration !== undefined && { duration: input.duration }),
        ...(input.difficulty !== undefined && { difficulty: input.difficulty as 'easy' | 'moderate' | 'challenging' }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      });
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: 'Activity not found' };
    }
  }

  async function deleteActivity(id: string): Promise<WeatherServiceResult<void>> {
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid activity ID' };
    }

    await weatherRepository.deleteActivity(id);
    return { success: true };
  }

  async function getRecommendedActivities(location: string): Promise<WeatherServiceResult<ActivityRecommendation[]>> {
    if (!location || location.trim() === '') {
      return { success: false, error: 'Location is required' };
    }

    // Get current weather
    const weather = await weatherRepository.getCurrentWeather(location.trim());
    
    if (!weather) {
      return { success: false, error: 'No weather data available for recommendations' };
    }

    // Get all activities
    const allActivities = await weatherRepository.getActivities();

    // Filter activities suitable for current conditions
    const recommended = allActivities.filter(activity => {
      // Check if weather condition is suitable
      if (!activity.suitableConditions.includes(weather.condition)) {
        return false;
      }

      // Check temperature range
      if (weather.temperatureCurrent < activity.minTemperature || 
          weather.temperatureCurrent > activity.maxTemperature) {
        return false;
      }

      // Check wind speed
      if (weather.windSpeed > activity.maxWindSpeed) {
        return false;
      }

      // Check precipitation
      if (weather.precipitation > activity.maxPrecipitation) {
        return false;
      }

      return true;
    });

    return { success: true, data: recommended };
  }

  // ============================================
  // WEATHER CALCULATIONS
  // ============================================

  function calculateHeatIndex(temperature: number, humidity: number): number {
    // Heat index formula (Fahrenheit-based, then convert to Celsius if needed)
    // Using Steadman's approximation
    if (temperature < 27) {
      return temperature; // Heat index not meaningful below 27°C
    }

    const T = temperature;
    const R = humidity;

    // Rothfusz regression
    let HI = -8.78469475556 + 
             1.61139411 * T + 
             2.33854883889 * R +
             -0.14611605 * T * R +
             -0.012308094 * T * T +
             -0.0164248277778 * R * R +
             0.002211732 * T * T * R +
             0.00072546 * T * R * R +
             -0.000003582 * T * T * R * R;

    return Math.round(HI * 10) / 10;
  }

  function calculateWindChill(temperature: number, windSpeed: number): number {
    // Wind chill formula (valid for temps below 10°C and wind > 4.8 km/h)
    if (temperature > 10 || windSpeed < 4.8) {
      return temperature;
    }

    const T = temperature;
    const V = windSpeed;

    const WC = 13.12 + 0.6215 * T - 11.37 * Math.pow(V, 0.16) + 0.3965 * T * Math.pow(V, 0.16);
    return Math.round(WC * 10) / 10;
  }

  function calculateFeelsLike(temperature: number, humidity: number, windSpeed: number): number {
    if (temperature >= 27) {
      return calculateHeatIndex(temperature, humidity);
    } else if (temperature <= 10 && windSpeed >= 4.8) {
      return calculateWindChill(temperature, windSpeed);
    }
    return temperature;
  }

  function getUVRiskLevel(uvIndex: number): string {
    if (uvIndex <= 2) return 'Low';
    if (uvIndex <= 5) return 'Moderate';
    if (uvIndex <= 7) return 'High';
    if (uvIndex <= 10) return 'Very High';
    return 'Extreme';
  }

  function getSunProtectionAdvice(uvIndex: number): string[] {
    const advice: string[] = [];
    
    if (uvIndex <= 2) {
      advice.push('Minimal sun protection needed for normal activities');
    } else if (uvIndex <= 5) {
      advice.push('Wear sunscreen SPF 30+');
      advice.push('Seek shade during midday hours');
    } else if (uvIndex <= 7) {
      advice.push('Wear sunscreen SPF 30+ and reapply every 2 hours');
      advice.push('Wear protective clothing and a hat');
      advice.push('Seek shade between 10am and 4pm');
    } else if (uvIndex <= 10) {
      advice.push('Wear sunscreen SPF 50+ and reapply frequently');
      advice.push('Wear protective clothing, hat, and UV-blocking sunglasses');
      advice.push('Avoid sun exposure between 10am and 4pm');
      advice.push('Stay in shade whenever possible');
    } else {
      advice.push('Avoid sun exposure if possible');
      advice.push('If outdoors, wear maximum protection');
      advice.push('Apply SPF 50+ every hour');
      advice.push('Stay in shade at all times');
    }
    
    return advice;
  }

  function isGoodBeachDay(weather: WeatherData): boolean {
    return (
      ['sunny', 'partly_cloudy'].includes(weather.condition) &&
      weather.temperatureCurrent >= 25 &&
      weather.temperatureCurrent <= 35 &&
      weather.windSpeed < 20 &&
      weather.precipitation < 5
    );
  }

  function isGoodPoolDay(weather: WeatherData): boolean {
    return (
      !['rainy', 'stormy', 'snowy'].includes(weather.condition) &&
      weather.temperatureCurrent >= 22 &&
      weather.windSpeed < 25 &&
      weather.precipitation < 10
    );
  }

  function isGoodHikingDay(weather: WeatherData): boolean {
    return (
      !['rainy', 'stormy', 'foggy'].includes(weather.condition) &&
      weather.temperatureCurrent >= 10 &&
      weather.temperatureCurrent <= 30 &&
      weather.windSpeed < 30 &&
      weather.precipitation < 5 &&
      weather.visibility >= 5
    );
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function getWeatherConditions(): WeatherCondition[] {
    return [...WEATHER_CONDITIONS];
  }

  function getActivityCategories(): string[] {
    return [...ACTIVITY_CATEGORIES];
  }

  function getDifficultyLevels(): string[] {
    return [...DIFFICULTY_LEVELS];
  }

  function formatTemperature(celsius: number, unit: 'C' | 'F' = 'C'): string {
    if (unit === 'F') {
      const fahrenheit = (celsius * 9/5) + 32;
      return `${Math.round(fahrenheit)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  }

  function formatWindSpeed(kmh: number, unit: 'kmh' | 'mph' | 'knots' = 'kmh'): string {
    switch (unit) {
      case 'mph':
        return `${Math.round(kmh * 0.621371)} mph`;
      case 'knots':
        return `${Math.round(kmh * 0.539957)} knots`;
      default:
        return `${Math.round(kmh)} km/h`;
    }
  }

  function getWeatherIcon(condition: WeatherCondition): string {
    const icons: Record<WeatherCondition, string> = {
      'sunny': '☀️',
      'partly_cloudy': '⛅',
      'cloudy': '☁️',
      'rainy': '🌧️',
      'stormy': '⛈️',
      'snowy': '🌨️',
      'foggy': '🌫️',
      'windy': '💨',
    };
    return icons[condition];
  }

  function getWeatherDescription(condition: WeatherCondition): string {
    const descriptions: Record<WeatherCondition, string> = {
      'sunny': 'Clear skies with plenty of sunshine',
      'partly_cloudy': 'Mix of sun and clouds',
      'cloudy': 'Overcast with gray skies',
      'rainy': 'Expect rain throughout the day',
      'stormy': 'Severe weather with thunder and lightning possible',
      'snowy': 'Snow expected, dress warmly',
      'foggy': 'Reduced visibility due to fog',
      'windy': 'Strong winds expected',
    };
    return descriptions[condition];
  }

  // ============================================
  // RETURN SERVICE
  // ============================================

  return {
    // Weather data
    recordWeather,
    getCurrentWeather,
    updateWeather,
    getWeatherHistory,
    
    // Alerts
    createAlert,
    getAlerts,
    deactivateAlert,
    deleteAlert,
    
    // Activities
    createActivity,
    getActivity,
    updateActivity,
    deleteActivity,
    getRecommendedActivities,
    
    // Calculations
    calculateHeatIndex,
    calculateWindChill,
    calculateFeelsLike,
    getUVRiskLevel,
    getSunProtectionAdvice,
    isGoodBeachDay,
    isGoodPoolDay,
    isGoodHikingDay,
    
    // Utilities
    getWeatherConditions,
    getActivityCategories,
    getDifficultyLevels,
    formatTemperature,
    formatWindSpeed,
    getWeatherIcon,
    getWeatherDescription,
  };
}
