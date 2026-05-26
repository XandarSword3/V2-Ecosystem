/**
 * Weather Service Tests
 * 
 * Unit tests for weather data, alerts, activity recommendations,
 * and weather calculations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createWeatherService } from '../../src/lib/services/weather.service';
import { InMemoryWeatherRepository } from '../../src/lib/repositories/weather.repository.memory';
import type { Container, WeatherData } from '../../src/lib/container/types';

describe('WeatherService', () => {
  let service: ReturnType<typeof createWeatherService>;
  let weatherRepository: InMemoryWeatherRepository;

  beforeEach(() => {
    weatherRepository = new InMemoryWeatherRepository();
    const container = { weatherRepository } as unknown as Container;
    service = createWeatherService(container);
  });

  describe('recordWeather', () => {
    it('should record weather with required fields', async () => {
      const result = await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 32, temperatureLow: 24, temperatureCurrent: 28, humidity: 65, windSpeed: 15 });
      expect(result.success).toBe(true);
      expect(result.data!.location).toBe('Resort Beach');
      expect(result.data!.condition).toBe('sunny');
      expect(result.data!.temperatureCurrent).toBe(28);
    });
    it('should set optional fields', async () => {
      const result = await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'partly_cloudy', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 70, windSpeed: 10, windDirection: 'NE', uvIndex: 8, precipitation: 0, visibility: 15, sunrise: '06:30', sunset: '19:00' });
      expect(result.success).toBe(true);
      expect(result.data!.windDirection).toBe('NE');
      expect(result.data!.uvIndex).toBe(8);
      expect(result.data!.visibility).toBe(15);
    });
    it('should reject empty location', async () => { expect((await service.recordWeather({ location: '', date: '2026-01-15', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 65, windSpeed: 10 })).error).toBe('Location is required'); });
    it('should reject invalid date', async () => { expect((await service.recordWeather({ location: 'Resort Beach', date: 'invalid-date', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 65, windSpeed: 10 })).error).toBe('Invalid date format'); });
    it('should reject invalid condition', async () => { expect((await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'hot', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 65, windSpeed: 10 })).error).toContain('Invalid condition'); });
    it('should reject high temp lower than low temp', async () => { expect((await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 20, temperatureLow: 25, temperatureCurrent: 22, humidity: 65, windSpeed: 10 })).error).toBe('High temperature cannot be lower than low temperature'); });
    it('should reject current temp outside range', async () => { expect((await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 35, humidity: 65, windSpeed: 10 })).error).toBe('Current temperature must be between low and high'); });
    it('should reject invalid humidity', async () => { expect((await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 150, windSpeed: 10 })).error).toBe('Humidity must be between 0 and 100'); });
    it('should reject negative wind speed', async () => { expect((await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 65, windSpeed: -5 })).error).toBe('Wind speed must be non-negative'); });
    it('should reject invalid UV index', async () => { expect((await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 65, windSpeed: 10, uvIndex: 20 })).error).toBe('UV index must be between 0 and 15'); });
    it('should reject negative precipitation', async () => { expect((await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'rainy', temperatureHigh: 25, temperatureLow: 20, temperatureCurrent: 22, humidity: 85, windSpeed: 10, precipitation: -5 })).error).toBe('Precipitation cannot be negative'); });
    it('should reject negative visibility', async () => { expect((await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'foggy', temperatureHigh: 20, temperatureLow: 15, temperatureCurrent: 17, humidity: 95, windSpeed: 5, visibility: -1 })).error).toBe('Visibility cannot be negative'); });
  });

  describe('getCurrentWeather', () => {
    it('should get current weather for location', async () => {
      await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 65, windSpeed: 10 });
      const result = await service.getCurrentWeather('Resort Beach');
      expect(result.success).toBe(true);
      expect(result.data!.location).toBe('Resort Beach');
    });
    it('should reject empty location', async () => { expect((await service.getCurrentWeather('')).error).toBe('Location is required'); });
    it('should return error for unknown location', async () => { expect((await service.getCurrentWeather('Unknown Place')).error).toBe('No weather data found for location'); });
  });

  describe('updateWeather', () => {
    it('should update weather data', async () => {
      const created = await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 65, windSpeed: 10 });
      const result = await service.updateWeather(created.data!.id, { condition: 'partly_cloudy', temperatureCurrent: 28 });
      expect(result.success).toBe(true);
      expect(result.data!.condition).toBe('partly_cloudy');
      expect(result.data!.temperatureCurrent).toBe(28);
    });
    it('should reject invalid ID', async () => { expect((await service.updateWeather('invalid-id', { condition: 'cloudy' })).error).toBe('Invalid weather ID'); });
    it('should reject invalid condition', async () => {
      const created = await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 65, windSpeed: 10 });
      expect((await service.updateWeather(created.data!.id, { condition: 'hot' })).error).toContain('Invalid condition');
    });
  });

  describe('getWeatherHistory', () => {
    it('should get weather history for date range', async () => {
      await service.recordWeather({ location: 'Resort Beach', date: '2026-01-10', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 65, windSpeed: 10 });
      await service.recordWeather({ location: 'Resort Beach', date: '2026-01-12', condition: 'cloudy', temperatureHigh: 28, temperatureLow: 20, temperatureCurrent: 24, humidity: 70, windSpeed: 15 });
      const result = await service.getWeatherHistory('Resort Beach', '2026-01-09', '2026-01-15');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
    it('should reject empty location', async () => { expect((await service.getWeatherHistory('', '2026-01-01', '2026-01-15')).error).toBe('Location is required'); });
    it('should reject invalid start date', async () => { expect((await service.getWeatherHistory('Resort Beach', 'invalid', '2026-01-15')).error).toBe('Invalid start date'); });
    it('should reject invalid end date', async () => { expect((await service.getWeatherHistory('Resort Beach', '2026-01-01', 'invalid')).error).toBe('Invalid end date'); });
    it('should reject end before start', async () => { expect((await service.getWeatherHistory('Resort Beach', '2026-01-15', '2026-01-01')).error).toBe('End date cannot be before start date'); });
  });

  describe('createAlert', () => {
    const baseAlert = { type: 'warning' as const, severity: 'moderate' as const, title: 'Storm Warning', description: 'Severe storm expected this evening', location: 'Resort Beach', startTime: '2026-01-15T18:00:00Z', endTime: '2026-01-16T06:00:00Z' };
    it('should create alert with required fields', async () => {
      const result = await service.createAlert(baseAlert);
      expect(result.success).toBe(true);
      expect(result.data!.title).toBe('Storm Warning');
      expect(result.data!.isActive).toBe(true);
    });
    it('should reject invalid alert type', async () => { expect((await service.createAlert({ ...baseAlert, type: 'danger' as any })).error).toContain('Invalid alert type'); });
    it('should reject invalid severity', async () => { expect((await service.createAlert({ ...baseAlert, severity: 'critical' as any })).error).toContain('Invalid severity'); });
    it('should reject empty title', async () => { expect((await service.createAlert({ ...baseAlert, title: '' })).error).toBe('Title is required'); });
    it('should reject empty description', async () => { expect((await service.createAlert({ ...baseAlert, description: '' })).error).toBe('Description is required'); });
    it('should reject empty location', async () => { expect((await service.createAlert({ ...baseAlert, location: '' })).error).toBe('Location is required'); });
    it('should reject end time before start time', async () => { expect((await service.createAlert({ ...baseAlert, startTime: '2026-01-16T06:00:00Z', endTime: '2026-01-15T18:00:00Z' })).error).toBe('End time must be after start time'); });
  });

  describe('getAlerts', () => {
    it('should get alerts for location', async () => {
      await service.createAlert({ type: 'warning', severity: 'moderate', title: 'Storm Warning', description: 'Severe storm expected', location: 'Resort Beach', startTime: '2026-01-15T18:00:00Z', endTime: '2026-01-16T06:00:00Z' });
      const result = await service.getAlerts('Resort Beach');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
    it('should reject empty location', async () => { expect((await service.getAlerts('')).error).toBe('Location is required'); });
  });

  describe('deactivateAlert', () => {
    it('should deactivate alert', async () => {
      const created = await service.createAlert({ type: 'warning', severity: 'moderate', title: 'Storm Warning', description: 'Severe storm expected', location: 'Resort Beach', startTime: '2026-01-15T18:00:00Z', endTime: '2026-01-16T06:00:00Z' });
      const result = await service.deactivateAlert(created.data!.id);
      expect(result.success).toBe(true);
      expect(result.data!.isActive).toBe(false);
    });
    it('should reject invalid ID', async () => { expect((await service.deactivateAlert('invalid')).error).toBe('Invalid alert ID'); });
  });

  describe('deleteAlert', () => {
    it('should delete alert', async () => {
      const created = await service.createAlert({ type: 'warning', severity: 'moderate', title: 'Storm Warning', description: 'Severe storm expected', location: 'Resort Beach', startTime: '2026-01-15T18:00:00Z', endTime: '2026-01-16T06:00:00Z' });
      expect((await service.deleteAlert(created.data!.id)).success).toBe(true);
    });
    it('should reject invalid ID', async () => { expect((await service.deleteAlert('invalid')).error).toBe('Invalid alert ID'); });
  });

  describe('createActivity', () => {
    it('should create activity with required fields', async () => {
      const result = await service.createActivity({ name: 'Beach Volleyball', description: 'Fun beach volleyball on the main beach', category: 'sports', suitableConditions: ['sunny', 'partly_cloudy'] });
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Beach Volleyball');
      expect(result.data!.isActive).toBe(true);
    });
    it('should set optional fields', async () => {
      const result = await service.createActivity({ name: 'Mountain Hiking', description: 'Hiking on mountain trails', category: 'outdoor', suitableConditions: ['sunny', 'partly_cloudy', 'cloudy'], minTemperature: 10, maxTemperature: 28, maxWindSpeed: 30, maxPrecipitation: 5, duration: 180, difficulty: 'challenging' });
      expect(result.success).toBe(true);
      expect(result.data!.minTemperature).toBe(10);
      expect(result.data!.difficulty).toBe('challenging');
    });
    it('should reject empty name', async () => { expect((await service.createActivity({ name: '', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'] })).error).toBe('Name is required'); });
    it('should reject empty description', async () => { expect((await service.createActivity({ name: 'Beach Volleyball', description: '', category: 'sports', suitableConditions: ['sunny'] })).error).toBe('Description is required'); });
    it('should reject invalid category', async () => { expect((await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'extreme', suitableConditions: ['sunny'] })).error).toContain('Invalid category'); });
    it('should reject empty conditions array', async () => { expect((await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: [] })).error).toBe('At least one suitable condition is required'); });
    it('should reject invalid condition', async () => { expect((await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny', 'hot'] })).error).toContain('Invalid condition: hot'); });
    it('should reject invalid difficulty', async () => { expect((await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'], difficulty: 'extreme' })).error).toContain('Invalid difficulty'); });
    it('should reject non-positive duration', async () => { expect((await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'], duration: 0 })).error).toBe('Duration must be positive'); });
    it('should reject min temp greater than max temp', async () => { expect((await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'], minTemperature: 30, maxTemperature: 20 })).error).toBe('Min temperature cannot be greater than max temperature'); });
    it('should reject negative max wind speed', async () => { expect((await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'], maxWindSpeed: -10 })).error).toBe('Max wind speed must be non-negative'); });
    it('should reject negative max precipitation', async () => { expect((await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'], maxPrecipitation: -5 })).error).toBe('Max precipitation must be non-negative'); });
  });

  describe('getActivity', () => {
    it('should get activity by ID', async () => {
      const created = await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'] });
      expect((await service.getActivity(created.data!.id)).data!.name).toBe('Beach Volleyball');
    });
    it('should reject invalid ID', async () => { expect((await service.getActivity('invalid')).error).toBe('Invalid activity ID'); });
    it('should return error for non-existent', async () => { expect((await service.getActivity('00000000-0000-0000-0000-000000000000')).error).toBe('Activity not found'); });
  });

  describe('updateActivity', () => {
    it('should update activity name', async () => {
      const created = await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'] });
      expect((await service.updateActivity(created.data!.id, { name: 'Beach Tennis' })).data!.name).toBe('Beach Tennis');
    });
    it('should update activity status', async () => {
      const created = await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'] });
      expect((await service.updateActivity(created.data!.id, { isActive: false })).data!.isActive).toBe(false);
    });
    it('should reject invalid ID', async () => { expect((await service.updateActivity('invalid', { name: 'New Name' })).error).toBe('Invalid activity ID'); });
    it('should reject empty name', async () => {
      const created = await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'] });
      expect((await service.updateActivity(created.data!.id, { name: '' })).error).toBe('Name cannot be empty');
    });
    it('should reject empty conditions array', async () => {
      const created = await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'] });
      expect((await service.updateActivity(created.data!.id, { suitableConditions: [] })).error).toBe('At least one suitable condition is required');
    });
  });

  describe('deleteActivity', () => {
    it('should delete activity', async () => {
      const created = await service.createActivity({ name: 'Beach Volleyball', description: 'Fun activity', category: 'sports', suitableConditions: ['sunny'] });
      expect((await service.deleteActivity(created.data!.id)).success).toBe(true);
    });
    it('should reject invalid ID', async () => { expect((await service.deleteActivity('invalid')).error).toBe('Invalid activity ID'); });
  });

  describe('getRecommendedActivities', () => {
    it('should get activities matching weather conditions', async () => {
      await service.recordWeather({ location: 'Resort Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 28, humidity: 65, windSpeed: 10, precipitation: 0 });
      await service.createActivity({ name: 'Beach Volleyball', description: 'Beach sports', category: 'sports', suitableConditions: ['sunny', 'partly_cloudy'], minTemperature: 20, maxTemperature: 35, maxWindSpeed: 25, maxPrecipitation: 0 });
      await service.createActivity({ name: 'Indoor Spa', description: 'Relaxation indoors', category: 'relaxation', suitableConditions: ['rainy', 'stormy'], minTemperature: 0, maxTemperature: 40 });
      const result = await service.getRecommendedActivities('Resort Beach');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('Beach Volleyball');
    });
    it('should reject empty location', async () => { expect((await service.getRecommendedActivities('')).error).toBe('Location is required'); });
    it('should return error when no weather data', async () => { expect((await service.getRecommendedActivities('Unknown')).error).toBe('No weather data available for recommendations'); });
  });

  describe('calculateHeatIndex', () => {
    it('should calculate heat index for hot humid weather', () => { expect(service.calculateHeatIndex(35, 80)).toBeGreaterThan(35); });
    it('should return temperature when too cool', () => { expect(service.calculateHeatIndex(20, 80)).toBe(20); });
  });

  describe('calculateWindChill', () => {
    it('should calculate wind chill for cold windy weather', () => { expect(service.calculateWindChill(5, 20)).toBeLessThan(5); });
    it('should return temperature when too warm', () => { expect(service.calculateWindChill(15, 20)).toBe(15); });
    it('should return temperature when wind too low', () => { expect(service.calculateWindChill(5, 2)).toBe(5); });
  });

  describe('calculateFeelsLike', () => {
    it('should use heat index for hot weather', () => { expect(service.calculateFeelsLike(35, 80, 10)).toBeGreaterThan(35); });
    it('should use wind chill for cold windy weather', () => { expect(service.calculateFeelsLike(5, 50, 25)).toBeLessThan(5); });
    it('should return actual temperature for moderate weather', () => { expect(service.calculateFeelsLike(20, 50, 10)).toBe(20); });
  });

  describe('getUVRiskLevel', () => {
    it('should return Low for UV <= 2', () => { expect(service.getUVRiskLevel(1)).toBe('Low'); expect(service.getUVRiskLevel(2)).toBe('Low'); });
    it('should return Moderate for UV 3-5', () => { expect(service.getUVRiskLevel(3)).toBe('Moderate'); expect(service.getUVRiskLevel(5)).toBe('Moderate'); });
    it('should return High for UV 6-7', () => { expect(service.getUVRiskLevel(6)).toBe('High'); expect(service.getUVRiskLevel(7)).toBe('High'); });
    it('should return Very High for UV 8-10', () => { expect(service.getUVRiskLevel(8)).toBe('Very High'); expect(service.getUVRiskLevel(10)).toBe('Very High'); });
    it('should return Extreme for UV > 10', () => { expect(service.getUVRiskLevel(11)).toBe('Extreme'); });
  });

  describe('getSunProtectionAdvice', () => {
    it('should give minimal advice for low UV', () => { const advice = service.getSunProtectionAdvice(1); expect(advice.length).toBeGreaterThan(0); expect(advice[0]).toContain('Minimal'); });
    it('should give more advice for high UV', () => { expect(service.getSunProtectionAdvice(9).length).toBeGreaterThan(service.getSunProtectionAdvice(2).length); });
    it('should give maximum advice for extreme UV', () => { const advice = service.getSunProtectionAdvice(12); expect(advice.length).toBeGreaterThanOrEqual(4); expect(advice[0]).toContain('Avoid'); });
  });

  describe('isGoodBeachDay', () => {
    it('should return true for ideal beach conditions', () => {
      expect(service.isGoodBeachDay({ id: 'test', location: 'Beach', date: '2026-01-15', condition: 'sunny', temperatureHigh: 32, temperatureLow: 24, temperatureCurrent: 28, humidity: 65, windSpeed: 10, windDirection: 'E', uvIndex: 8, precipitation: 0, visibility: 15, sunrise: '06:00', sunset: '18:00', createdAt: new Date().toISOString(), updatedAt: null })).toBe(true);
    });
    it('should return false for rainy weather', () => {
      expect(service.isGoodBeachDay({ id: 'test', location: 'Beach', date: '2026-01-15', condition: 'rainy', temperatureHigh: 25, temperatureLow: 20, temperatureCurrent: 22, humidity: 90, windSpeed: 20, windDirection: 'E', uvIndex: 2, precipitation: 15, visibility: 5, sunrise: '06:00', sunset: '18:00', createdAt: new Date().toISOString(), updatedAt: null })).toBe(false);
    });
  });

  describe('isGoodPoolDay', () => {
    it('should return true for good pool conditions', () => {
      expect(service.isGoodPoolDay({ id: 'test', location: 'Resort', date: '2026-01-15', condition: 'partly_cloudy', temperatureHigh: 30, temperatureLow: 22, temperatureCurrent: 26, humidity: 60, windSpeed: 15, windDirection: 'N', uvIndex: 6, precipitation: 0, visibility: 10, sunrise: '06:00', sunset: '18:00', createdAt: new Date().toISOString(), updatedAt: null })).toBe(true);
    });
    it('should return false for stormy weather', () => {
      expect(service.isGoodPoolDay({ id: 'test', location: 'Resort', date: '2026-01-15', condition: 'stormy', temperatureHigh: 25, temperatureLow: 18, temperatureCurrent: 20, humidity: 85, windSpeed: 40, windDirection: 'W', uvIndex: 1, precipitation: 25, visibility: 3, sunrise: '06:00', sunset: '18:00', createdAt: new Date().toISOString(), updatedAt: null })).toBe(false);
    });
  });

  describe('isGoodHikingDay', () => {
    it('should return true for good hiking conditions', () => {
      expect(service.isGoodHikingDay({ id: 'test', location: 'Mountain', date: '2026-01-15', condition: 'partly_cloudy', temperatureHigh: 25, temperatureLow: 15, temperatureCurrent: 20, humidity: 50, windSpeed: 15, windDirection: 'N', uvIndex: 5, precipitation: 0, visibility: 20, sunrise: '06:00', sunset: '18:00', createdAt: new Date().toISOString(), updatedAt: null })).toBe(true);
    });
    it('should return false for foggy weather', () => {
      expect(service.isGoodHikingDay({ id: 'test', location: 'Mountain', date: '2026-01-15', condition: 'foggy', temperatureHigh: 15, temperatureLow: 10, temperatureCurrent: 12, humidity: 95, windSpeed: 5, windDirection: 'N', uvIndex: 1, precipitation: 0, visibility: 1, sunrise: '06:00', sunset: '18:00', createdAt: new Date().toISOString(), updatedAt: null })).toBe(false);
    });
  });

  describe('getWeatherConditions', () => {
    it('should return all weather conditions', () => { const c = service.getWeatherConditions(); expect(c).toContain('sunny'); expect(c).toContain('rainy'); expect(c).toContain('snowy'); expect(c.length).toBe(8); });
  });

  describe('getActivityCategories', () => {
    it('should return all activity categories', () => { const c = service.getActivityCategories(); expect(c).toContain('outdoor'); expect(c).toContain('indoor'); expect(c).toContain('water'); expect(c.length).toBe(6); });
  });

  describe('getDifficultyLevels', () => {
    it('should return all difficulty levels', () => { const l = service.getDifficultyLevels(); expect(l).toContain('easy'); expect(l).toContain('moderate'); expect(l).toContain('challenging'); expect(l.length).toBe(3); });
  });

  describe('formatTemperature', () => {
    it('should format in Celsius by default', () => { expect(service.formatTemperature(25)).toBe('25°C'); });
    it('should format in Fahrenheit', () => { expect(service.formatTemperature(25, 'F')).toBe('77°F'); });
  });

  describe('formatWindSpeed', () => {
    it('should format in km/h by default', () => { expect(service.formatWindSpeed(50)).toBe('50 km/h'); });
    it('should format in mph', () => { expect(service.formatWindSpeed(50, 'mph')).toBe('31 mph'); });
    it('should format in knots', () => { expect(service.formatWindSpeed(50, 'knots')).toBe('27 knots'); });
  });

  describe('getWeatherIcon', () => {
    it('should return sun emoji for sunny', () => { expect(service.getWeatherIcon('sunny')).toBe('☀️'); });
    it('should return cloud emoji for cloudy', () => { expect(service.getWeatherIcon('cloudy')).toBe('☁️'); });
    it('should return rain emoji for rainy', () => { expect(service.getWeatherIcon('rainy')).toBe('🌧️'); });
  });

  describe('getWeatherDescription', () => {
    it('should return description for sunny', () => { expect(service.getWeatherDescription('sunny')).toContain('sunshine'); });
    it('should return description for rainy', () => { expect(service.getWeatherDescription('rainy')).toContain('rain'); });
    it('should return description for snowy', () => { expect(service.getWeatherDescription('snowy')).toContain('Snow'); });
  });
});
