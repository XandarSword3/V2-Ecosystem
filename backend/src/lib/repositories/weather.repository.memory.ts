/**
 * In-Memory Weather Repository
 * 
 * Test double implementation for weather data operations.
 */

import { randomUUID } from 'crypto';
import type { 
  WeatherRepository, 
  WeatherData, 
  WeatherAlert, 
  ActivityRecommendation 
} from '../container/types';

export class InMemoryWeatherRepository implements WeatherRepository {
  private weatherData: Map<string, WeatherData> = new Map();
  private alerts: Map<string, WeatherAlert> = new Map();
  private activities: Map<string, ActivityRecommendation> = new Map();

  async getCurrentWeather(location: string): Promise<WeatherData | null> {
    const allWeather = Array.from(this.weatherData.values());
    const locationWeather = allWeather
      .filter(w => w.location === location)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return locationWeather[0] || null;
  }

  async saveWeather(data: Omit<WeatherData, 'id' | 'createdAt' | 'updatedAt'>): Promise<WeatherData> {
    const weather: WeatherData = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    this.weatherData.set(weather.id, weather);
    return weather;
  }

  async updateWeather(id: string, data: Partial<WeatherData>): Promise<WeatherData> {
    const existing = this.weatherData.get(id);
    if (!existing) throw new Error('Weather data not found');
    
    const updated: WeatherData = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.weatherData.set(id, updated);
    return updated;
  }

  async getWeatherHistory(location: string, startDate: string, endDate: string): Promise<WeatherData[]> {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    return Array.from(this.weatherData.values())
      .filter(w => {
        const weatherDate = new Date(w.date).getTime();
        return w.location === location && weatherDate >= start && weatherDate <= end;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async getAlerts(location: string): Promise<WeatherAlert[]> {
    return Array.from(this.alerts.values())
      .filter(a => a.location === location && a.isActive);
  }

  async createAlert(data: Omit<WeatherAlert, 'id' | 'createdAt'>): Promise<WeatherAlert> {
    const alert: WeatherAlert = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.alerts.set(alert.id, alert);
    return alert;
  }

  async updateAlert(id: string, data: Partial<WeatherAlert>): Promise<WeatherAlert> {
    const existing = this.alerts.get(id);
    if (!existing) throw new Error('Alert not found');
    
    const updated: WeatherAlert = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    this.alerts.set(id, updated);
    return updated;
  }

  async deleteAlert(id: string): Promise<void> {
    this.alerts.delete(id);
  }

  async getActivities(): Promise<ActivityRecommendation[]> {
    return Array.from(this.activities.values()).filter(a => a.isActive);
  }

  async getActivityById(id: string): Promise<ActivityRecommendation | null> {
    return this.activities.get(id) || null;
  }

  async createActivity(data: Omit<ActivityRecommendation, 'id' | 'createdAt'>): Promise<ActivityRecommendation> {
    const activity: ActivityRecommendation = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.activities.set(activity.id, activity);
    return activity;
  }

  async updateActivity(id: string, data: Partial<ActivityRecommendation>): Promise<ActivityRecommendation> {
    const existing = this.activities.get(id);
    if (!existing) throw new Error('Activity not found');
    
    const updated: ActivityRecommendation = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
    };
    this.activities.set(id, updated);
    return updated;
  }

  async deleteActivity(id: string): Promise<void> {
    this.activities.delete(id);
  }

  // Test utility method
  clear(): void {
    this.weatherData.clear();
    this.alerts.clear();
    this.activities.clear();
  }
}
