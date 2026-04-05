/**
 * In-Memory Weather Repository
 * Test double for WeatherRepository using in-memory data structures.
 */

import type {
  WeatherRepository,
  WeatherData,
  WeatherAlert,
  ActivityRecommendation,
} from '../container/types.js';

export class InMemoryWeatherRepository implements WeatherRepository {
  private weatherData = new Map<string, WeatherData>(); // location -> latest
  private weatherHistory: WeatherData[] = [];
  private alerts = new Map<string, WeatherAlert>();
  private activities = new Map<string, ActivityRecommendation>();

  reset() {
    this.weatherData.clear();
    this.weatherHistory = [];
    this.alerts.clear();
    this.activities.clear();
  }

  // Weather operations
  async getCurrentWeather(location: string): Promise<WeatherData | null> {
    return this.weatherData.get(location) ?? null;
  }

  async saveWeather(data: Omit<WeatherData, 'id' | 'createdAt' | 'updatedAt'>): Promise<WeatherData> {
    const id = crypto.randomUUID();
    const weather: WeatherData = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.weatherData.set(data.location, weather);
    this.weatherHistory.push(weather);
    return weather;
  }

  async updateWeather(id: string, data: Partial<WeatherData>): Promise<WeatherData> {
    for (const [location, w] of this.weatherData) {
      if (w.id === id) {
        const updated = { ...w, ...data, updatedAt: new Date().toISOString() };
        this.weatherData.set(location, updated);
        return updated;
      }
    }
    throw new Error(`Weather ${id} not found`);
  }

  async getWeatherHistory(location: string, startDate: string, endDate: string): Promise<WeatherData[]> {
    return this.weatherHistory.filter(
      w => w.location === location && w.date >= startDate && w.date <= endDate
    );
  }

  // Alert operations
  async getAlerts(location: string): Promise<WeatherAlert[]> {
    return [...this.alerts.values()].filter(a => a.location === location && a.isActive);
  }

  async createAlert(data: Omit<WeatherAlert, 'id' | 'createdAt'>): Promise<WeatherAlert> {
    const id = crypto.randomUUID();
    const alert: WeatherAlert = { ...data, id, createdAt: new Date().toISOString() };
    this.alerts.set(id, alert);
    return alert;
  }

  async updateAlert(id: string, data: Partial<WeatherAlert>): Promise<WeatherAlert> {
    const existing = this.alerts.get(id);
    if (!existing) throw new Error(`Alert ${id} not found`);
    const updated = { ...existing, ...data };
    this.alerts.set(id, updated);
    return updated;
  }

  async deleteAlert(id: string): Promise<void> {
    this.alerts.delete(id);
  }

  // Activity operations
  async getActivities(): Promise<ActivityRecommendation[]> {
    return [...this.activities.values()].filter(a => a.isActive);
  }

  async getActivityById(id: string): Promise<ActivityRecommendation | null> {
    return this.activities.get(id) ?? null;
  }

  async createActivity(data: Omit<ActivityRecommendation, 'id' | 'createdAt'>): Promise<ActivityRecommendation> {
    const id = crypto.randomUUID();
    const activity: ActivityRecommendation = { ...data, id, createdAt: new Date().toISOString() };
    this.activities.set(id, activity);
    return activity;
  }

  async updateActivity(id: string, data: Partial<ActivityRecommendation>): Promise<ActivityRecommendation> {
    const existing = this.activities.get(id);
    if (!existing) throw new Error(`Activity ${id} not found`);
    const updated = { ...existing, ...data };
    this.activities.set(id, updated);
    return updated;
  }

  async deleteActivity(id: string): Promise<void> {
    this.activities.delete(id);
  }
}
