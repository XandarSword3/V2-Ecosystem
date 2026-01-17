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
    
    const container = {
      weatherRepository,
    } as unknown as Container;
    
    service = createWeatherService(container);
  });

  // ============================================
  // RECORD WEATHER TESTS
  // ============================================

  describe('recordWeather', () => {
    it('should record weather with required fields', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 32,
        temperatureLow: 24,
        temperatureCurrent: 28,
        humidity: 65,
        windSpeed: 15,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.location).toBe('Resort Beach');
      expect(result.data!.condition).toBe('sunny');
      expect(result.data!.temperatureCurrent).toBe(28);
    });

    it('should set optional fields', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'partly_cloudy',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 70,
        windSpeed: 10,
        windDirection: 'NE',
        uvIndex: 8,
        precipitation: 0,
        visibility: 15,
        sunrise: '06:30',
        sunset: '19:00',
      });

      expect(result.success).toBe(true);
      expect(result.data!.windDirection).toBe('NE');
      expect(result.data!.uvIndex).toBe(8);
      expect(result.data!.visibility).toBe(15);
    });

    it('should reject empty location', async () => {
      const result = await service.recordWeather({
        location: '',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 65,
        windSpeed: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Location is required');
    });

    it('should reject invalid date', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: 'invalid-date',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 65,
        windSpeed: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid date format');
    });

    it('should reject invalid condition', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'hot',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 65,
        windSpeed: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid condition');
    });

    it('should reject high temp lower than low temp', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 20,
        temperatureLow: 25,
        temperatureCurrent: 22,
        humidity: 65,
        windSpeed: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('High temperature cannot be lower than low temperature');
    });

    it('should reject current temp outside range', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 35,
        humidity: 65,
        windSpeed: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current temperature must be between low and high');
    });

    it('should reject invalid humidity', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 150,
        windSpeed: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Humidity must be between 0 and 100');
    });

    it('should reject negative wind speed', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 65,
        windSpeed: -5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Wind speed must be non-negative');
    });

    it('should reject invalid UV index', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 65,
        windSpeed: 10,
        uvIndex: 20,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('UV index must be between 0 and 15');
    });

    it('should reject negative precipitation', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'rainy',
        temperatureHigh: 25,
        temperatureLow: 20,
        temperatureCurrent: 22,
        humidity: 85,
        windSpeed: 10,
        precipitation: -5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Precipitation cannot be negative');
    });

    it('should reject negative visibility', async () => {
      const result = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'foggy',
        temperatureHigh: 20,
        temperatureLow: 15,
        temperatureCurrent: 17,
        humidity: 95,
        windSpeed: 5,
        visibility: -1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Visibility cannot be negative');
    });
  });

  // ============================================
  // GET CURRENT WEATHER TESTS
  // ============================================

  describe('getCurrentWeather', () => {
    it('should get current weather for location', async () => {
      await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 65,
        windSpeed: 10,
      });

      const result = await service.getCurrentWeather('Resort Beach');

      expect(result.success).toBe(true);
      expect(result.data!.location).toBe('Resort Beach');
    });

    it('should reject empty location', async () => {
      const result = await service.getCurrentWeather('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Location is required');
    });

    it('should return error for unknown location', async () => {
      const result = await service.getCurrentWeather('Unknown Place');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No weather data found for location');
    });
  });

  // ============================================
  // UPDATE WEATHER TESTS
  // ============================================

  describe('updateWeather', () => {
    it('should update weather data', async () => {
      const created = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 65,
        windSpeed: 10,
      });

      const result = await service.updateWeather(created.data!.id, {
        condition: 'partly_cloudy',
        temperatureCurrent: 28,
      });

      expect(result.success).toBe(true);
      expect(result.data!.condition).toBe('partly_cloudy');
      expect(result.data!.temperatureCurrent).toBe(28);
    });

    it('should reject invalid ID', async () => {
      const result = await service.updateWeather('invalid-id', {
        condition: 'cloudy',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid weather ID');
    });

    it('should reject invalid condition', async () => {
      const created = await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 65,
        windSpeed: 10,
      });

      const result = await service.updateWeather(created.data!.id, {
        condition: 'hot',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid condition');
    });
  });

  // ============================================
  // WEATHER HISTORY TESTS
  // ============================================

  describe('getWeatherHistory', () => {
    it('should get weather history for date range', async () => {
      await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-10',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 65,
        windSpeed: 10,
      });

      await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-12',
        condition: 'cloudy',
        temperatureHigh: 28,
        temperatureLow: 20,
        temperatureCurrent: 24,
        humidity: 70,
        windSpeed: 15,
      });

      const result = await service.getWeatherHistory('Resort Beach', '2026-01-09', '2026-01-15');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should reject empty location', async () => {
      const result = await service.getWeatherHistory('', '2026-01-01', '2026-01-15');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Location is required');
    });

    it('should reject invalid start date', async () => {
      const result = await service.getWeatherHistory('Resort Beach', 'invalid', '2026-01-15');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid start date');
    });

    it('should reject invalid end date', async () => {
      const result = await service.getWeatherHistory('Resort Beach', '2026-01-01', 'invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid end date');
    });

    it('should reject end before start', async () => {
      const result = await service.getWeatherHistory('Resort Beach', '2026-01-15', '2026-01-01');

      expect(result.success).toBe(false);
      expect(result.error).toBe('End date cannot be before start date');
    });
  });

  // ============================================
  // WEATHER ALERTS TESTS
  // ============================================

  describe('createAlert', () => {
    it('should create alert with required fields', async () => {
      const result = await service.createAlert({
        type: 'warning',
        severity: 'moderate',
        title: 'Storm Warning',
        description: 'Severe storm expected this evening',
        location: 'Resort Beach',
        startTime: '2026-01-15T18:00:00Z',
        endTime: '2026-01-16T06:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.data!.title).toBe('Storm Warning');
      expect(result.data!.severity).toBe('moderate');
      expect(result.data!.isActive).toBe(true);
    });

    it('should reject invalid alert type', async () => {
      const result = await service.createAlert({
        type: 'danger',
        severity: 'moderate',
        title: 'Storm Warning',
        description: 'Severe storm expected',
        location: 'Resort Beach',
        startTime: '2026-01-15T18:00:00Z',
        endTime: '2026-01-16T06:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid alert type');
    });

    it('should reject invalid severity', async () => {
      const result = await service.createAlert({
        type: 'warning',
        severity: 'critical',
        title: 'Storm Warning',
        description: 'Severe storm expected',
        location: 'Resort Beach',
        startTime: '2026-01-15T18:00:00Z',
        endTime: '2026-01-16T06:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid severity');
    });

    it('should reject empty title', async () => {
      const result = await service.createAlert({
        type: 'warning',
        severity: 'moderate',
        title: '',
        description: 'Severe storm expected',
        location: 'Resort Beach',
        startTime: '2026-01-15T18:00:00Z',
        endTime: '2026-01-16T06:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Title is required');
    });

    it('should reject empty description', async () => {
      const result = await service.createAlert({
        type: 'warning',
        severity: 'moderate',
        title: 'Storm Warning',
        description: '',
        location: 'Resort Beach',
        startTime: '2026-01-15T18:00:00Z',
        endTime: '2026-01-16T06:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Description is required');
    });

    it('should reject empty location', async () => {
      const result = await service.createAlert({
        type: 'warning',
        severity: 'moderate',
        title: 'Storm Warning',
        description: 'Severe storm expected',
        location: '',
        startTime: '2026-01-15T18:00:00Z',
        endTime: '2026-01-16T06:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Location is required');
    });

    it('should reject end time before start time', async () => {
      const result = await service.createAlert({
        type: 'warning',
        severity: 'moderate',
        title: 'Storm Warning',
        description: 'Severe storm expected',
        location: 'Resort Beach',
        startTime: '2026-01-16T06:00:00Z',
        endTime: '2026-01-15T18:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('End time must be after start time');
    });
  });

  describe('getAlerts', () => {
    it('should get alerts for location', async () => {
      await service.createAlert({
        type: 'warning',
        severity: 'moderate',
        title: 'Storm Warning',
        description: 'Severe storm expected',
        location: 'Resort Beach',
        startTime: '2026-01-15T18:00:00Z',
        endTime: '2026-01-16T06:00:00Z',
      });

      const result = await service.getAlerts('Resort Beach');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should reject empty location', async () => {
      const result = await service.getAlerts('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Location is required');
    });
  });

  describe('deactivateAlert', () => {
    it('should deactivate alert', async () => {
      const created = await service.createAlert({
        type: 'warning',
        severity: 'moderate',
        title: 'Storm Warning',
        description: 'Severe storm expected',
        location: 'Resort Beach',
        startTime: '2026-01-15T18:00:00Z',
        endTime: '2026-01-16T06:00:00Z',
      });

      const result = await service.deactivateAlert(created.data!.id);

      expect(result.success).toBe(true);
      expect(result.data!.isActive).toBe(false);
    });

    it('should reject invalid ID', async () => {
      const result = await service.deactivateAlert('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid alert ID');
    });
  });

  describe('deleteAlert', () => {
    it('should delete alert', async () => {
      const created = await service.createAlert({
        type: 'warning',
        severity: 'moderate',
        title: 'Storm Warning',
        description: 'Severe storm expected',
        location: 'Resort Beach',
        startTime: '2026-01-15T18:00:00Z',
        endTime: '2026-01-16T06:00:00Z',
      });

      const result = await service.deleteAlert(created.data!.id);

      expect(result.success).toBe(true);
    });

    it('should reject invalid ID', async () => {
      const result = await service.deleteAlert('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid alert ID');
    });
  });

  // ============================================
  // ACTIVITY TESTS
  // ============================================

  describe('createActivity', () => {
    it('should create activity with required fields', async () => {
      const result = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun beach volleyball on the main beach',
        category: 'sports',
        suitableConditions: ['sunny', 'partly_cloudy'],
      });

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Beach Volleyball');
      expect(result.data!.category).toBe('sports');
      expect(result.data!.isActive).toBe(true);
    });

    it('should set optional fields', async () => {
      const result = await service.createActivity({
        name: 'Mountain Hiking',
        description: 'Hiking on mountain trails',
        category: 'outdoor',
        suitableConditions: ['sunny', 'partly_cloudy', 'cloudy'],
        minTemperature: 10,
        maxTemperature: 28,
        maxWindSpeed: 30,
        maxPrecipitation: 5,
        duration: 180,
        difficulty: 'challenging',
      });

      expect(result.success).toBe(true);
      expect(result.data!.minTemperature).toBe(10);
      expect(result.data!.maxTemperature).toBe(28);
      expect(result.data!.difficulty).toBe('challenging');
    });

    it('should reject empty name', async () => {
      const result = await service.createActivity({
        name: '',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    it('should reject empty description', async () => {
      const result = await service.createActivity({
        name: 'Beach Volleyball',
        description: '',
        category: 'sports',
        suitableConditions: ['sunny'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Description is required');
    });

    it('should reject invalid category', async () => {
      const result = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'extreme',
        suitableConditions: ['sunny'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid category');
    });

    it('should reject empty conditions array', async () => {
      const result = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one suitable condition is required');
    });

    it('should reject invalid condition', async () => {
      const result = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny', 'hot'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid condition: hot');
    });

    it('should reject invalid difficulty', async () => {
      const result = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
        difficulty: 'extreme',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid difficulty');
    });

    it('should reject non-positive duration', async () => {
      const result = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
        duration: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Duration must be positive');
    });

    it('should reject min temp greater than max temp', async () => {
      const result = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
        minTemperature: 30,
        maxTemperature: 20,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Min temperature cannot be greater than max temperature');
    });

    it('should reject negative max wind speed', async () => {
      const result = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
        maxWindSpeed: -10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Max wind speed must be non-negative');
    });

    it('should reject negative max precipitation', async () => {
      const result = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
        maxPrecipitation: -5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Max precipitation must be non-negative');
    });
  });

  describe('getActivity', () => {
    it('should get activity by ID', async () => {
      const created = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
      });

      const result = await service.getActivity(created.data!.id);

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Beach Volleyball');
    });

    it('should reject invalid ID', async () => {
      const result = await service.getActivity('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid activity ID');
    });

    it('should return error for non-existent', async () => {
      const result = await service.getActivity('00000000-0000-0000-0000-000000000000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Activity not found');
    });
  });

  describe('updateActivity', () => {
    it('should update activity name', async () => {
      const created = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
      });

      const result = await service.updateActivity(created.data!.id, {
        name: 'Beach Tennis',
      });

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Beach Tennis');
    });

    it('should update activity status', async () => {
      const created = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
      });

      const result = await service.updateActivity(created.data!.id, {
        isActive: false,
      });

      expect(result.success).toBe(true);
      expect(result.data!.isActive).toBe(false);
    });

    it('should reject invalid ID', async () => {
      const result = await service.updateActivity('invalid', { name: 'New Name' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid activity ID');
    });

    it('should reject empty name', async () => {
      const created = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
      });

      const result = await service.updateActivity(created.data!.id, {
        name: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Name cannot be empty');
    });

    it('should reject empty conditions array', async () => {
      const created = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
      });

      const result = await service.updateActivity(created.data!.id, {
        suitableConditions: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one suitable condition is required');
    });
  });

  describe('deleteActivity', () => {
    it('should delete activity', async () => {
      const created = await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Fun activity',
        category: 'sports',
        suitableConditions: ['sunny'],
      });

      const result = await service.deleteActivity(created.data!.id);

      expect(result.success).toBe(true);
    });

    it('should reject invalid ID', async () => {
      const result = await service.deleteActivity('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid activity ID');
    });
  });

  describe('getRecommendedActivities', () => {
    it('should get activities matching weather conditions', async () => {
      // Record sunny weather
      await service.recordWeather({
        location: 'Resort Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 28,
        humidity: 65,
        windSpeed: 10,
        precipitation: 0,
      });

      // Create activities
      await service.createActivity({
        name: 'Beach Volleyball',
        description: 'Beach sports',
        category: 'sports',
        suitableConditions: ['sunny', 'partly_cloudy'],
        minTemperature: 20,
        maxTemperature: 35,
        maxWindSpeed: 25,
        maxPrecipitation: 0,
      });

      await service.createActivity({
        name: 'Indoor Spa',
        description: 'Relaxation indoors',
        category: 'relaxation',
        suitableConditions: ['rainy', 'stormy'],
        minTemperature: 0,
        maxTemperature: 40,
      });

      const result = await service.getRecommendedActivities('Resort Beach');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('Beach Volleyball');
    });

    it('should reject empty location', async () => {
      const result = await service.getRecommendedActivities('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Location is required');
    });

    it('should return error when no weather data', async () => {
      const result = await service.getRecommendedActivities('Unknown');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No weather data available for recommendations');
    });
  });

  // ============================================
  // CALCULATIONS TESTS
  // ============================================

  describe('calculateHeatIndex', () => {
    it('should calculate heat index for hot humid weather', () => {
      const result = service.calculateHeatIndex(35, 80);
      expect(result).toBeGreaterThan(35);
    });

    it('should return temperature when too cool', () => {
      const result = service.calculateHeatIndex(20, 80);
      expect(result).toBe(20);
    });
  });

  describe('calculateWindChill', () => {
    it('should calculate wind chill for cold windy weather', () => {
      const result = service.calculateWindChill(5, 20);
      expect(result).toBeLessThan(5);
    });

    it('should return temperature when too warm', () => {
      const result = service.calculateWindChill(15, 20);
      expect(result).toBe(15);
    });

    it('should return temperature when wind too low', () => {
      const result = service.calculateWindChill(5, 2);
      expect(result).toBe(5);
    });
  });

  describe('calculateFeelsLike', () => {
    it('should use heat index for hot weather', () => {
      const result = service.calculateFeelsLike(35, 80, 10);
      expect(result).toBeGreaterThan(35);
    });

    it('should use wind chill for cold windy weather', () => {
      const result = service.calculateFeelsLike(5, 50, 25);
      expect(result).toBeLessThan(5);
    });

    it('should return actual temperature for moderate weather', () => {
      const result = service.calculateFeelsLike(20, 50, 10);
      expect(result).toBe(20);
    });
  });

  describe('getUVRiskLevel', () => {
    it('should return Low for UV <= 2', () => {
      expect(service.getUVRiskLevel(1)).toBe('Low');
      expect(service.getUVRiskLevel(2)).toBe('Low');
    });

    it('should return Moderate for UV 3-5', () => {
      expect(service.getUVRiskLevel(3)).toBe('Moderate');
      expect(service.getUVRiskLevel(5)).toBe('Moderate');
    });

    it('should return High for UV 6-7', () => {
      expect(service.getUVRiskLevel(6)).toBe('High');
      expect(service.getUVRiskLevel(7)).toBe('High');
    });

    it('should return Very High for UV 8-10', () => {
      expect(service.getUVRiskLevel(8)).toBe('Very High');
      expect(service.getUVRiskLevel(10)).toBe('Very High');
    });

    it('should return Extreme for UV > 10', () => {
      expect(service.getUVRiskLevel(11)).toBe('Extreme');
    });
  });

  describe('getSunProtectionAdvice', () => {
    it('should give minimal advice for low UV', () => {
      const advice = service.getSunProtectionAdvice(1);
      expect(advice.length).toBeGreaterThan(0);
      expect(advice[0]).toContain('Minimal');
    });

    it('should give more advice for high UV', () => {
      const lowAdvice = service.getSunProtectionAdvice(2);
      const highAdvice = service.getSunProtectionAdvice(9);
      expect(highAdvice.length).toBeGreaterThan(lowAdvice.length);
    });

    it('should give maximum advice for extreme UV', () => {
      const advice = service.getSunProtectionAdvice(12);
      expect(advice.length).toBeGreaterThanOrEqual(4);
      expect(advice[0]).toContain('Avoid');
    });
  });

  describe('isGoodBeachDay', () => {
    it('should return true for ideal beach conditions', () => {
      const weather: WeatherData = {
        id: 'test',
        location: 'Beach',
        date: '2026-01-15',
        condition: 'sunny',
        temperatureHigh: 32,
        temperatureLow: 24,
        temperatureCurrent: 28,
        humidity: 65,
        windSpeed: 10,
        windDirection: 'E',
        uvIndex: 8,
        precipitation: 0,
        visibility: 15,
        sunrise: '06:00',
        sunset: '18:00',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      expect(service.isGoodBeachDay(weather)).toBe(true);
    });

    it('should return false for rainy weather', () => {
      const weather: WeatherData = {
        id: 'test',
        location: 'Beach',
        date: '2026-01-15',
        condition: 'rainy',
        temperatureHigh: 25,
        temperatureLow: 20,
        temperatureCurrent: 22,
        humidity: 90,
        windSpeed: 20,
        windDirection: 'E',
        uvIndex: 2,
        precipitation: 15,
        visibility: 5,
        sunrise: '06:00',
        sunset: '18:00',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      expect(service.isGoodBeachDay(weather)).toBe(false);
    });
  });

  describe('isGoodPoolDay', () => {
    it('should return true for good pool conditions', () => {
      const weather: WeatherData = {
        id: 'test',
        location: 'Resort',
        date: '2026-01-15',
        condition: 'partly_cloudy',
        temperatureHigh: 30,
        temperatureLow: 22,
        temperatureCurrent: 26,
        humidity: 60,
        windSpeed: 15,
        windDirection: 'N',
        uvIndex: 6,
        precipitation: 0,
        visibility: 10,
        sunrise: '06:00',
        sunset: '18:00',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      expect(service.isGoodPoolDay(weather)).toBe(true);
    });

    it('should return false for stormy weather', () => {
      const weather: WeatherData = {
        id: 'test',
        location: 'Resort',
        date: '2026-01-15',
        condition: 'stormy',
        temperatureHigh: 25,
        temperatureLow: 18,
        temperatureCurrent: 20,
        humidity: 85,
        windSpeed: 40,
        windDirection: 'W',
        uvIndex: 1,
        precipitation: 25,
        visibility: 3,
        sunrise: '06:00',
        sunset: '18:00',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      expect(service.isGoodPoolDay(weather)).toBe(false);
    });
  });

  describe('isGoodHikingDay', () => {
    it('should return true for good hiking conditions', () => {
      const weather: WeatherData = {
        id: 'test',
        location: 'Mountain',
        date: '2026-01-15',
        condition: 'partly_cloudy',
        temperatureHigh: 25,
        temperatureLow: 15,
        temperatureCurrent: 20,
        humidity: 50,
        windSpeed: 15,
        windDirection: 'N',
        uvIndex: 5,
        precipitation: 0,
        visibility: 20,
        sunrise: '06:00',
        sunset: '18:00',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      expect(service.isGoodHikingDay(weather)).toBe(true);
    });

    it('should return false for foggy weather', () => {
      const weather: WeatherData = {
        id: 'test',
        location: 'Mountain',
        date: '2026-01-15',
        condition: 'foggy',
        temperatureHigh: 15,
        temperatureLow: 10,
        temperatureCurrent: 12,
        humidity: 95,
        windSpeed: 5,
        windDirection: 'N',
        uvIndex: 1,
        precipitation: 0,
        visibility: 1,
        sunrise: '06:00',
        sunset: '18:00',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

      expect(service.isGoodHikingDay(weather)).toBe(false);
    });
  });

  // ============================================
  // UTILITY FUNCTION TESTS
  // ============================================

  describe('getWeatherConditions', () => {
    it('should return all weather conditions', () => {
      const conditions = service.getWeatherConditions();
      expect(conditions).toContain('sunny');
      expect(conditions).toContain('rainy');
      expect(conditions).toContain('snowy');
      expect(conditions.length).toBe(8);
    });
  });

  describe('getActivityCategories', () => {
    it('should return all activity categories', () => {
      const categories = service.getActivityCategories();
      expect(categories).toContain('outdoor');
      expect(categories).toContain('indoor');
      expect(categories).toContain('water');
      expect(categories.length).toBe(6);
    });
  });

  describe('getDifficultyLevels', () => {
    it('should return all difficulty levels', () => {
      const levels = service.getDifficultyLevels();
      expect(levels).toContain('easy');
      expect(levels).toContain('moderate');
      expect(levels).toContain('challenging');
      expect(levels.length).toBe(3);
    });
  });

  describe('formatTemperature', () => {
    it('should format in Celsius by default', () => {
      expect(service.formatTemperature(25)).toBe('25°C');
    });

    it('should format in Fahrenheit', () => {
      expect(service.formatTemperature(25, 'F')).toBe('77°F');
    });
  });

  describe('formatWindSpeed', () => {
    it('should format in km/h by default', () => {
      expect(service.formatWindSpeed(50)).toBe('50 km/h');
    });

    it('should format in mph', () => {
      expect(service.formatWindSpeed(50, 'mph')).toBe('31 mph');
    });

    it('should format in knots', () => {
      expect(service.formatWindSpeed(50, 'knots')).toBe('27 knots');
    });
  });

  describe('getWeatherIcon', () => {
    it('should return sun emoji for sunny', () => {
      expect(service.getWeatherIcon('sunny')).toBe('☀️');
    });

    it('should return cloud emoji for cloudy', () => {
      expect(service.getWeatherIcon('cloudy')).toBe('☁️');
    });

    it('should return rain emoji for rainy', () => {
      expect(service.getWeatherIcon('rainy')).toBe('🌧️');
    });
  });

  describe('getWeatherDescription', () => {
    it('should return description for sunny', () => {
      const desc = service.getWeatherDescription('sunny');
      expect(desc).toContain('sunshine');
    });

    it('should return description for rainy', () => {
      const desc = service.getWeatherDescription('rainy');
      expect(desc).toContain('rain');
    });

    it('should return description for snowy', () => {
      const desc = service.getWeatherDescription('snowy');
      expect(desc).toContain('Snow');
    });
  });
});
