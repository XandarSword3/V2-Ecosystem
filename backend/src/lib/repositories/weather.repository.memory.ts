import type { WeatherData, WeatherAlert, WeatherActivity } from '../container/types';

export class InMemoryWeatherRepository {
  private weather: Map<string, WeatherData> = new Map();
  private alerts: Map<string, WeatherAlert> = new Map();
  private activities: Map<string, WeatherActivity> = new Map();

  async saveWeather(data: WeatherData): Promise<WeatherData> {
    this.weather.set(data.id, { ...data });
    return data;
  }

  async findWeatherById(id: string): Promise<WeatherData | null> {
    return this.weather.get(id) ?? null;
  }

  async findWeatherByLocation(location: string): Promise<WeatherData | null> {
    // Return the most recent entry for the location
    const entries = Array.from(this.weather.values())
      .filter(w => w.location === location)
      .sort((a, b) => b.date.localeCompare(a.date));
    return entries[0] ?? null;
  }

  async findWeatherHistory(location: string, from: string, to: string): Promise<WeatherData[]> {
    return Array.from(this.weather.values())
      .filter(w => w.location === location && w.date >= from && w.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async saveAlert(alert: WeatherAlert): Promise<WeatherAlert> {
    this.alerts.set(alert.id, { ...alert });
    return alert;
  }

  async findAlertById(id: string): Promise<WeatherAlert | null> {
    return this.alerts.get(id) ?? null;
  }

  async findAlertsByLocation(location: string): Promise<WeatherAlert[]> {
    return Array.from(this.alerts.values()).filter(a => a.location === location);
  }

  async deleteAlert(id: string): Promise<void> {
    this.alerts.delete(id);
  }

  async saveActivity(activity: WeatherActivity): Promise<WeatherActivity> {
    this.activities.set(activity.id, { ...activity });
    return activity;
  }

  async findActivityById(id: string): Promise<WeatherActivity | null> {
    return this.activities.get(id) ?? null;
  }

  async findAllActivities(): Promise<WeatherActivity[]> {
    return Array.from(this.activities.values());
  }

  async deleteActivity(id: string): Promise<void> {
    this.activities.delete(id);
  }
}
