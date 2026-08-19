/**

 * Alert Service

 * Phase 2 Upgrade: Intelligent threshold monitoring and notification system

 */



import { getSupabase } from '../../database/connection.js';

import { logger } from '../../utils/logger.js';

import { v4 as uuidv4 } from 'uuid';

import dayjs from 'dayjs';

import nodemailer from 'nodemailer';

import { realtimeAnalytics } from './realtime-analytics.service.js';



export type AlertType = 'threshold' | 'deviation' | 'anomaly' | 'trend';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';



interface AlertCondition {

  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';

  value: number;

  duration?: number; // minutes the condition must persist

}



interface AlertSchedule {

  frequency: 'realtime' | 'hourly' | 'daily';

  timeOfDay?: string; // HH:mm for daily

  daysOfWeek?: number[]; // 0-6

}



interface NotificationChannel {

  type: 'in_app' | 'email' | 'sms' | 'webhook';

  target: string; // user_id, email, phone, or webhook_url

  config?: Record<string, unknown>;

}



interface AlertDefinition {

  id: string;

  propertyId: string;

  name: string;

  description?: string;

  alertType: AlertType;

  kpiCode: string;

  condition: AlertCondition;

  schedule: AlertSchedule;

  severity: AlertSeverity;

  notificationChannels: NotificationChannel[];

  cooldownMinutes: number;

  isActive: boolean;

  createdBy: string;

  createdAt: Date;

}



interface AlertHistory {

  id: string;

  alertDefinitionId: string;

  propertyId: string;

  triggeredAt: Date;

  acknowledgedAt?: Date;

  resolvedAt?: Date;

  acknowledgedBy?: string;

  metricValue: number;

  thresholdValue: number;

  context: Record<string, unknown>;

  status: AlertStatus;

  severity: AlertSeverity;

  notificationsSent: string[];

}



export class AlertService {

  private supabase = getSupabase();

  private emailTransporter: nodemailer.Transporter | null = null;

  private activeAlerts: Map<string, AlertHistory> = new Map();

  private lastTriggerTime: Map<string, Date> = new Map();

  private checkInterval: NodeJS.Timeout | null = null;



  constructor() {

    this.initEmailTransporter();

    this.startMonitoring();

  }



  private initEmailTransporter(): void {

    if (process.env.SMTP_HOST) {

      this.emailTransporter = nodemailer.createTransport({

        host: process.env.SMTP_HOST,

        port: parseInt(process.env.SMTP_PORT || '587'),

        secure: process.env.SMTP_SECURE === 'true',

        auth: {

          user: process.env.SMTP_USER,

          pass: process.env.SMTP_PASS

        }

      });

    }

  }



  private startMonitoring(): void {

    // Check alerts every minute

    this.checkInterval = setInterval(() => this.checkAllAlerts(), 60000);

    logger.info('Alert monitoring started');

  }



  stopMonitoring(): void {

    if (this.checkInterval) {

      clearInterval(this.checkInterval);

      this.checkInterval = null;

    }

  }



  // =============================================

  // ALERT DEFINITIONS CRUD

  // =============================================



  async createAlertDefinition(

    propertyId: string,

    userId: string,

    data: Omit<AlertDefinition, 'id' | 'createdAt' | 'createdBy'>

  ): Promise<AlertDefinition> {

    const id = uuidv4();



    const { data: alert, error } = await this.supabase

      .from('alert_definitions')

      .insert({

        id,

        property_id: propertyId,

        name: data.name,

        description: data.description,

        alert_type: data.alertType,

        kpi_code: data.kpiCode,

        condition: data.condition,

        schedule: data.schedule,

        severity: data.severity,

        notification_channels: data.notificationChannels,

        cooldown_minutes: data.cooldownMinutes || 30,

        is_active: data.isActive ?? true,

        created_by: userId,

        created_at: new Date().toISOString()

      })

      .select()

      .single();



    if (error) throw error;



    return this.mapAlertDefinitionFromDb(alert);

  }



  async getAlertDefinitions(

    propertyId: string,

    options?: { activeOnly?: boolean; kpiCode?: string }

  ): Promise<AlertDefinition[]> {

    let query = this.supabase

      .from('alert_definitions')

      .select('*')

      .eq('property_id', propertyId);



    if (options?.activeOnly) {

      query = query.eq('is_active', true);

    }



    if (options?.kpiCode) {

      query = query.eq('kpi_code', options.kpiCode);

    }



    const { data, error } = await query.order('created_at', { ascending: false });



    if (error) throw error;



    return (data || []).map(this.mapAlertDefinitionFromDb);

  }



  async updateAlertDefinition(

    alertId: string,

    data: Partial<AlertDefinition>

  ): Promise<AlertDefinition> {

    const updateData: Record<string, unknown> = {};



    if (data.name !== undefined) updateData.name = data.name;

    if (data.description !== undefined) updateData.description = data.description;

    if (data.condition !== undefined) updateData.condition = data.condition;

    if (data.schedule !== undefined) updateData.schedule = data.schedule;

    if (data.severity !== undefined) updateData.severity = data.severity;

    if (data.notificationChannels !== undefined) updateData.notification_channels = data.notificationChannels;

    if (data.cooldownMinutes !== undefined) updateData.cooldown_minutes = data.cooldownMinutes;

    if (data.isActive !== undefined) updateData.is_active = data.isActive;



    updateData.updated_at = new Date().toISOString();



    const { data: alert, error } = await this.supabase

      .from('alert_definitions')

      .update(updateData)

      .eq('id', alertId)

      .select()

      .single();



    if (error) throw error;



    return this.mapAlertDefinitionFromDb(alert);

  }



  async deleteAlertDefinition(alertId: string): Promise<void> {

    // Deactivate rather than delete for audit trail

    const { error } = await this.supabase

      .from('alert_definitions')

      .update({ is_active: false, updated_at: new Date().toISOString() })

      .eq('id', alertId);



    if (error) throw error;

  }



  // =============================================

  // ALERT MONITORING & CHECKING

  // =============================================



  private async checkAllAlerts(): Promise<void> {

    try {

      // Get all active alert definitions

      const { data: definitions, error } = await this.supabase

        .from('alert_definitions')

        .select('*')

        .eq('is_active', true);



      if (error) {

        logger.error('Error fetching alert definitions:', error);

        return;

      }



      for (const def of (definitions || [])) {

        await this.checkSingleAlert(this.mapAlertDefinitionFromDb(def));

      }

    } catch (error) {

      logger.error('Error in alert monitoring cycle:', error);

    }

  }



  private async checkSingleAlert(definition: AlertDefinition): Promise<void> {

    // Check cooldown

    const lastTrigger = this.lastTriggerTime.get(definition.id);

    if (lastTrigger) {

      const minutesSinceLastTrigger = (Date.now() - lastTrigger.getTime()) / (1000 * 60);

      if (minutesSinceLastTrigger < definition.cooldownMinutes) {

        return; // Still in cooldown

      }

    }



    // Check if should run based on schedule

    if (!this.shouldRunNow(definition.schedule)) {

      return;

    }



    // Get current metric value

    const currentValue = await this.getCurrentMetricValue(

      definition.propertyId,

      definition.kpiCode

    );



    // Check condition

    const conditionMet = this.evaluateCondition(currentValue, definition.condition);



    if (conditionMet) {

      // Check if there's already an active alert for this definition

      const existingAlert = Array.from(this.activeAlerts.values()).find(

        a => a.alertDefinitionId === definition.id && a.status === 'active'

      );



      if (existingAlert) {

        // Update existing alert with new context

        await this.updateAlertContext(existingAlert.id, currentValue);

      } else {

        // Create new alert

        await this.triggerAlert(definition, currentValue);

      }

    } else {

      // Check if we should resolve any active alerts

      const activeAlert = Array.from(this.activeAlerts.values()).find(

        a => a.alertDefinitionId === definition.id && a.status === 'active'

      );



      if (activeAlert) {

        await this.resolveAlert(activeAlert.id);

      }

    }

  }



  private shouldRunNow(schedule: AlertSchedule): boolean {

    const now = dayjs();



    switch (schedule.frequency) {

      case 'realtime':

        return true;

      

      case 'hourly':

        return now.minute() === 0; // Run at the start of each hour

      

      case 'daily':

        if (!schedule.timeOfDay) return false;

        const [hour, minute] = schedule.timeOfDay.split(':').map(Number);

        if (now.hour() !== hour || now.minute() !== minute) return false;

        

        if (schedule.daysOfWeek) {

          return schedule.daysOfWeek.includes(now.day());

        }

        return true;

      

      default:

        return false;

    }

  }



  private async getCurrentMetricValue(propertyId: string, kpiCode: string): Promise<number> {

    // Get current metric value from database

    switch (kpiCode) {

      case 'occupancy_rate': {

        const today = dayjs().format('YYYY-MM-DD');

        const { count: checkedIn } = await this.supabase

          .from('transactions')

          .select('*', { count: 'exact', head: true })

          .eq('engine_type', 'time_exclusive_reservation')

          .eq('property_id', propertyId)

          .eq('status', 'checked_in')

          .filter('metadata->>check_in_date', 'lte', today)

          .filter('metadata->>check_out_date', 'gt', today);



        const { data: rooms } = await this.supabase

          .from('rooms')

          .select('id')

          .eq('property_id', propertyId)

          .eq('is_active', true);



        return ((checkedIn || 0) / (rooms?.length || 1)) * 100;

      }



      case 'today_revenue': {

        const { data: bookings } = await this.supabase

          .from('transactions')

          .select('amount')

          .eq('engine_type', 'time_exclusive_reservation')

          .eq('property_id', propertyId)

          .gte('created_at', dayjs().startOf('day').toISOString())

          .lte('created_at', dayjs().endOf('day').toISOString())

          .in('status', ['confirmed', 'checked_in', 'checked_out']);



        return (bookings || []).reduce((sum, b: any) => sum + (b.amount || 0), 0);

      }



      case 'adr': {

        const { data: bookings } = await this.supabase

          .from('transactions')

          .select('amount, metadata')

          .eq('engine_type', 'time_exclusive_reservation')

          .eq('property_id', propertyId)

          .in('status', ['confirmed', 'checked_in', 'checked_out'])

          .filter('metadata->>check_in_date', 'gte', dayjs().startOf('day').format('YYYY-MM-DD'))

          .filter('metadata->>check_in_date', 'lte', dayjs().endOf('day').format('YYYY-MM-DD'));



        const totalNights = (bookings || []).reduce((sum: number, b: any) => sum + (b.metadata?.nights || 1), 0);

        const totalRate = (bookings || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

        return totalNights > 0 ? totalRate / totalNights : 0;

      }



      case 'revpar': {

        const { data: rooms } = await this.supabase

          .from('rooms')

          .select('id')

          .eq('property_id', propertyId)

          .eq('is_active', true);



        const { data: bookings } = await this.supabase

          .from('transactions')

          .select('amount')

          .eq('engine_type', 'time_exclusive_reservation')

          .eq('property_id', propertyId)

          .in('status', ['confirmed', 'checked_in', 'checked_out'])

          .filter('metadata->>check_in_date', 'gte', dayjs().startOf('day').format('YYYY-MM-DD'))

          .filter('metadata->>check_in_date', 'lte', dayjs().endOf('day').format('YYYY-MM-DD'));



        const totalRevenue = (bookings || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

        return totalRevenue / (rooms?.length || 1);

      }



      case 'cancellation_rate': {

        const { count: total } = await this.supabase

          .from('transactions')

          .select('*', { count: 'exact', head: true })

          .eq('engine_type', 'time_exclusive_reservation')

          .eq('property_id', propertyId)

          .gte('created_at', dayjs().startOf('month').toISOString());



        const { count: cancelled } = await this.supabase

          .from('transactions')

          .select('*', { count: 'exact', head: true })

          .eq('engine_type', 'time_exclusive_reservation')

          .eq('property_id', propertyId)

          .eq('status', 'cancelled')

          .gte('created_at', dayjs().startOf('month').toISOString());



        return (total || 0) > 0 ? ((cancelled || 0) / (total || 1)) * 100 : 0;

      }



      default:

        // Try to get from KPI definitions

        const { data: kpi } = await this.supabase

          .from('kpi_definitions')

          .select('calculation_type')

          .eq('code', kpiCode)

          .single();



        if (kpi) {

          // Use existing reporting service calculation

          const { reportingService } = await import('../reporting/reporting.service.js');

          const kpis = await reportingService.getKPIs(

            propertyId,

            { start: dayjs().startOf('day').toDate(), end: dayjs().endOf('day').toDate() },

            [kpiCode]

          );

          return kpis[0]?.value || 0;

        }



        return 0;

    }

  }



  private evaluateCondition(value: number, condition: AlertCondition): boolean {

    switch (condition.operator) {

      case '>': return value > condition.value;

      case '<': return value < condition.value;

      case '>=': return value >= condition.value;

      case '<=': return value <= condition.value;

      case '==': return value === condition.value;

      case '!=': return value !== condition.value;

      default: return false;

    }

  }



  // =============================================

  // ALERT TRIGGERING & NOTIFICATIONS

  // =============================================



  private async triggerAlert(definition: AlertDefinition, metricValue: number): Promise<void> {

    const id = uuidv4();

    const now = new Date();



    // Create alert history record

    const alert: AlertHistory = {

      id,

      alertDefinitionId: definition.id,

      propertyId: definition.propertyId,

      triggeredAt: now,

      metricValue,

      thresholdValue: definition.condition.value,

      context: await this.gatherAlertContext(definition),

      status: 'active',

      severity: definition.severity,

      notificationsSent: []

    };



    const { error } = await this.supabase.from('alert_history').insert({

      id,

      alert_definition_id: definition.id,

      property_id: definition.propertyId,

      triggered_at: now.toISOString(),

      metric_value: metricValue,

      threshold_value: definition.condition.value,

      context: alert.context,

      status: 'active',

      severity: definition.severity,

      notifications_sent: []

    });



    if (error) {

      logger.error('Error creating alert history:', error);

      return;

    }



    this.activeAlerts.set(id, alert);

    this.lastTriggerTime.set(definition.id, now);



    // Send notifications

    for (const channel of definition.notificationChannels) {

      try {

        await this.sendNotification(channel, definition, alert);

        alert.notificationsSent.push(channel.type);

      } catch (error) {

        logger.error(`Error sending ${channel.type} notification:`, error);

      }

    }



    // Update with sent notifications

    await this.supabase

      .from('alert_history')

      .update({ notifications_sent: alert.notificationsSent })

      .eq('id', id);



    // Notify real-time analytics subscribers

    realtimeAnalytics.notifyMetricChange(definition.propertyId, 'alert_triggered', 1);



    logger.info(`Alert triggered: ${definition.name} (value: ${metricValue})`);

  }



  private async sendNotification(

    channel: NotificationChannel,

    definition: AlertDefinition,

    alert: AlertHistory

  ): Promise<void> {

    switch (channel.type) {

      case 'in_app':

        await this.sendInAppNotification(channel.target, definition, alert);

        break;

      

      case 'email':

        await this.sendEmailNotification(channel.target, definition, alert);

        break;

      

      case 'sms':

        await this.sendSMSNotification(channel.target, definition, alert);

        break;

      

      case 'webhook':

        await this.sendWebhookNotification(channel.target, definition, alert);

        break;

    }

  }



  private async sendInAppNotification(

    userId: string,

    definition: AlertDefinition,

    alert: AlertHistory

  ): Promise<void> {

    const { data: property } = await this.supabase
      .from('properties')
      .select('tenant_id')
      .eq('id', definition.propertyId)
      .single();
    if (!property?.tenant_id) {
      throw new Error(`Cannot create alert notification without tenant scope for property ${definition.propertyId}`);
    }

    await this.supabase.from('notifications').insert({

      id: uuidv4(),

      user_id: userId,

      property_id: definition.propertyId,

      tenant_id: property.tenant_id,

      type: 'alert',

      title: `Alert: ${definition.name}`,

      message: `${definition.kpiCode} is ${alert.metricValue} (threshold: ${definition.condition.value})`,

      data: {

        alert_id: alert.id,

        alert_definition_id: definition.id,

        severity: definition.severity,

        metric_value: alert.metricValue,

        threshold_value: definition.condition.value

      },

      is_read: false,

      created_at: new Date().toISOString()

    });

  }



  private async sendEmailNotification(

    email: string,

    definition: AlertDefinition,

    alert: AlertHistory

  ): Promise<void> {

    if (!this.emailTransporter) {

      logger.warn('Email transporter not configured');

      return;

    }



    const subject = `[${definition.severity.toUpperCase()}] Alert: ${definition.name}`;

    const html = `

      <h2>Alert Triggered: ${definition.name}</h2>

      <p><strong>Severity:</strong> ${definition.severity}</p>

      <p><strong>Metric:</strong> ${definition.kpiCode}</p>

      <p><strong>Current Value:</strong> ${alert.metricValue}</p>

      <p><strong>Threshold:</strong> ${definition.condition.operator} ${definition.condition.value}</p>

      <p><strong>Time:</strong> ${alert.triggeredAt.toISOString()}</p>

      ${definition.description ? `<p><strong>Description:</strong> ${definition.description}</p>` : ''}

      <hr>

      <p><a href="${process.env.FRONTEND_URL}/admin/alerts/${alert.id}">View in Dashboard</a></p>

    `;



    await this.emailTransporter.sendMail({

      from: process.env.SMTP_FROM || 'alerts@v2ecosystem.com',

      to: email,

      subject,

      html

    });

  }



  private async sendSMSNotification(

    phoneNumber: string,

    definition: AlertDefinition,

    _alert: AlertHistory

  ): Promise<void> {

    // Placeholder for SMS integration (Twilio, etc.)

    logger.info(`SMS notification would be sent to ${phoneNumber}: ${definition.name}`);

  }



  private async sendWebhookNotification(

    webhookUrl: string,

    definition: AlertDefinition,

    alert: AlertHistory

  ): Promise<void> {

    try {

      await fetch(webhookUrl, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

          alert_id: alert.id,

          alert_name: definition.name,

          severity: definition.severity,

          kpi_code: definition.kpiCode,

          metric_value: alert.metricValue,

          threshold_value: definition.condition.value,

          triggered_at: alert.triggeredAt.toISOString(),

          context: alert.context

        })

      });

    } catch (error) {

      logger.error('Webhook notification failed:', error);

    }

  }



  // =============================================

  // ALERT MANAGEMENT

  // =============================================



  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {

    const { error } = await this.supabase

      .from('alert_history')

      .update({

        status: 'acknowledged',

        acknowledged_at: new Date().toISOString(),

        acknowledged_by: userId

      })

      .eq('id', alertId);



    if (error) throw error;



    const alert = this.activeAlerts.get(alertId);

    if (alert) {

      alert.status = 'acknowledged';

      alert.acknowledgedBy = userId;

      alert.acknowledgedAt = new Date();

    }



    logger.info(`Alert ${alertId} acknowledged by ${userId}`);

  }



  async resolveAlert(alertId: string): Promise<void> {

    const { error } = await this.supabase

      .from('alert_history')

      .update({

        status: 'resolved',

        resolved_at: new Date().toISOString()

      })

      .eq('id', alertId);



    if (error) throw error;



    const alert = this.activeAlerts.get(alertId);

    if (alert) {

      alert.status = 'resolved';

      alert.resolvedAt = new Date();

    }



    this.activeAlerts.delete(alertId);

    logger.info(`Alert ${alertId} resolved`);

  }



  async getActiveAlerts(propertyId: string): Promise<AlertHistory[]> {

    const { data, error } = await this.supabase

      .from('alert_history')

      .select(`

        *,

        definition:alert_definitions(name, kpi_code, severity)

      `)

      .eq('property_id', propertyId)

      .eq('status', 'active')

      .order('triggered_at', { ascending: false });



    if (error) throw error;



    return (data || []).map(this.mapAlertHistoryFromDb);

  }



  async getAlertHistory(

    propertyId: string,

    options?: { status?: AlertStatus; from?: Date; to?: Date; limit?: number }

  ): Promise<AlertHistory[]> {

    let query = this.supabase

      .from('alert_history')

      .select(`

        *,

        definition:alert_definitions(name, kpi_code, severity)

      `)

      .eq('property_id', propertyId);



    if (options?.status) {

      query = query.eq('status', options.status);

    }



    if (options?.from) {

      query = query.gte('triggered_at', options.from.toISOString());

    }



    if (options?.to) {

      query = query.lte('triggered_at', options.to.toISOString());

    }



    query = query.order('triggered_at', { ascending: false });



    if (options?.limit) {

      query = query.limit(options.limit);

    }



    const { data, error } = await query;



    if (error) throw error;



    return (data || []).map(this.mapAlertHistoryFromDb);

  }



  // =============================================

  // HELPERS

  // =============================================



  private async gatherAlertContext(definition: AlertDefinition): Promise<Record<string, unknown>> {

    const context: Record<string, unknown> = {};



    // Add relevant data based on KPI type

    switch (definition.kpiCode) {

      case 'occupancy_rate': {

        const { data: rooms } = await this.supabase

          .from('rooms')

          .select('id, metadata_id, metadatas(name)')

          .eq('property_id', definition.propertyId)

          .eq('is_active', true);

        context.totalRooms = rooms?.length || 0;

        const roomTypes: Record<string, number> = {};

        for (const r of rooms || []) {

          const rt = r.metadatas as unknown as { name?: string } | null;

          const typeName = rt?.name || 'Unknown';

          roomTypes[typeName] = (roomTypes[typeName] || 0) + 1;

        }

        context.roomTypes = roomTypes;

        break;

      }



      case 'today_revenue': {

        const { data: revenueBySource } = await this.supabase

          .from('transactions')

          .select('metadata, amount')

          .eq('engine_type', 'time_exclusive_reservation')

          .eq('property_id', definition.propertyId)

          .gte('created_at', dayjs().startOf('day').toISOString())

          .lte('created_at', dayjs().endOf('day').toISOString())

          .in('status', ['confirmed', 'checked_in', 'checked_out']);



        const bySource: Record<string, number> = {};

        for (const b of revenueBySource || []) {

          const meta = b.metadata as Record<string, unknown> | null;

          const source = (meta?.source as string) || 'direct';

          bySource[source] = (bySource[source] || 0) + (b.amount || 0);

        }

        context.revenueBySource = bySource;

        break;

      }

    }



    // Add forecast comparison if available

    const { data: forecast } = await this.supabase

      .from('demand_forecasts')

      .select('forecasted_demand, forecasted_revenue')

      .eq('property_id', definition.propertyId)

      .eq('forecast_date', dayjs().format('YYYY-MM-DD'))

      .single();



    if (forecast) {

      context.forecastComparison = {

        forecastedDemand: forecast.forecasted_demand,

        forecastedRevenue: forecast.forecasted_revenue

      };

    }



    return context;

  }



  private async updateAlertContext(alertId: string, newValue: number): Promise<void> {

    const alert = this.activeAlerts.get(alertId);

    if (!alert) return;



    alert.metricValue = newValue;

    alert.context.lastUpdated = new Date().toISOString();



    await this.supabase

      .from('alert_history')

      .update({

        metric_value: newValue,

        context: alert.context

      })

      .eq('id', alertId);

  }



  private mapAlertDefinitionFromDb(db: any): AlertDefinition {

    return {

      id: db.id,

      propertyId: db.property_id,

      name: db.name,

      description: db.description,

      alertType: db.alert_type,

      kpiCode: db.kpi_code,

      condition: db.condition,

      schedule: db.schedule,

      severity: db.severity,

      notificationChannels: db.notification_channels,

      cooldownMinutes: db.cooldown_minutes,

      isActive: db.is_active,

      createdBy: db.created_by,

      createdAt: new Date(db.created_at)

    };

  }



  private mapAlertHistoryFromDb(db: any): AlertHistory {

    return {

      id: db.id,

      alertDefinitionId: db.alert_definition_id,

      propertyId: db.property_id,

      triggeredAt: new Date(db.triggered_at),

      acknowledgedAt: db.acknowledged_at ? new Date(db.acknowledged_at) : undefined,

      resolvedAt: db.resolved_at ? new Date(db.resolved_at) : undefined,

      acknowledgedBy: db.acknowledged_by,

      metricValue: db.metric_value,

      thresholdValue: db.threshold_value,

      context: db.context || {},

      status: db.status,

      severity: db.severity,

      notificationsSent: db.notifications_sent || []

    };

  }

}



export const alertService = new AlertService();

