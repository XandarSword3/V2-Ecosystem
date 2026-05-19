// Reporting Service - Converted to Supabase
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Parser } from 'json2csv';

// =============================================
// TYPES
// =============================================

interface ReportResult {
  data: any[];
  totals?: Record<string, number>;
  metadata: {
    generatedAt: Date;
    rowCount: number;
    executionTimeMs: number;
  };
}

interface DateRange {
  start: Date;
  end: Date;
}

interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

// =============================================
// REPORTING SERVICE
// =============================================

class ReportingService {
  private get supabase() {
    return getSupabase();
  }

  private emailTransporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initEmailTransporter();
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

  // =============================================
  // REPORT TEMPLATES
  // =============================================

  async getTemplates(propertyId: string, category?: string): Promise<any[]> {
    let query = this.supabase
      .from('report_templates')
      .select('*')
      .or(`property_id.eq.${propertyId},is_system.eq.true`)
      .eq('is_active', true);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('sort_order').order('name');

    if (error) throw error;
    return data || [];
  }

  async getTemplateById(templateId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('report_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createTemplate(propertyId: string, data: {
    name: string;
    description?: string;
    category: string;
    queryConfig: any;
    defaultParams?: any;
    columnConfig?: any;
    chartConfig?: any;
    allowedRoles?: string[];
  }, userId: string): Promise<any> {
    const id = uuidv4();

    const { data: template, error } = await this.supabase
      .from('report_templates')
      .insert({
        id,
        property_id: propertyId,
        name: data.name,
        description: data.description || null,
        category: data.category,
        query_config: data.queryConfig,
        default_params: data.defaultParams || {},
        column_config: data.columnConfig || [],
        chart_config: data.chartConfig || null,
        allowed_roles: data.allowedRoles || ['admin', 'manager'],
        is_system: false,
        is_active: true,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return template;
  }

  async updateTemplate(templateId: string, data: Partial<{
    name: string;
    description: string;
    category: string;
    queryConfig: any;
    defaultParams: any;
    columnConfig: any;
    chartConfig: any;
    allowedRoles: string[];
    isActive: boolean;
  }>): Promise<any> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.queryConfig !== undefined) updateData.query_config = data.queryConfig;
    if (data.defaultParams !== undefined) updateData.default_params = data.defaultParams;
    if (data.columnConfig !== undefined) updateData.column_config = data.columnConfig;
    if (data.chartConfig !== undefined) updateData.chart_config = data.chartConfig;
    if (data.allowedRoles !== undefined) updateData.allowed_roles = data.allowedRoles;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: template, error } = await this.supabase
      .from('report_templates')
      .update(updateData)
      .eq('id', templateId)
      .eq('is_system', false)
      .select()
      .single();

    if (error) throw error;
    return template;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await this.supabase
      .from('report_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', templateId)
      .eq('is_system', false);

    if (error) throw error;
  }

  // =============================================
  // REPORT EXECUTION
  // Controller calls: executeReport(propertyId, templateId, params, userId)
  // =============================================

  async executeReport(
    propertyId: string,
    templateId: string,
    params: Record<string, any> = {},
    userId: string
  ): Promise<ReportResult> {
    const startTime = Date.now();

    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error('Report template not found');
    }

    const mergedParams = { ...template.default_params, ...params };
    const queryConfig = template.query_config;

    // Build and execute the query
    const data = await this.buildReportQuery(propertyId, queryConfig, mergedParams);

    // Calculate totals if configured
    let totals: Record<string, number> = {};
    if (queryConfig.aggregateColumns && queryConfig.aggregateColumns.length > 0) {
      totals = this.calculateTotals(data, queryConfig.aggregateColumns);
    }

    const executionTime = Date.now() - startTime;

    // Log execution
    await this.supabase.from('report_execution_log').insert({
      id: uuidv4(),
      template_id: templateId,
      property_id: propertyId,
      executed_by: userId,
      params: mergedParams,
      execution_time_ms: executionTime,
      row_count: data.length
    });

    return {
      data,
      totals,
      metadata: {
        generatedAt: new Date(),
        rowCount: data.length,
        executionTimeMs: executionTime
      }
    };
  }

  private async buildReportQuery(
    propertyId: string,
    config: any,
    params: Record<string, any>
  ): Promise<any[]> {
    const tableName = config.table || 'bookings';
    const selectColumns = config.columns?.join(', ') || '*';

    let query = this.supabase
      .from(tableName)
      .select(selectColumns)
      .eq('property_id', propertyId);

    // Apply date filters
    if (params.dateRange?.start) {
      const dateCol = config.dateColumn || 'created_at';
      query = query.gte(dateCol, params.dateRange.start.toISOString());
    }
    if (params.dateRange?.end) {
      const dateCol = config.dateColumn || 'created_at';
      query = query.lte(dateCol, params.dateRange.end.toISOString());
    }

    // Apply additional filters
    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }
    }

    // Apply ordering
    if (params.sortBy) {
      query = query.order(params.sortBy, { ascending: false });
    } else if (config.orderBy) {
      query = query.order(config.orderBy, { ascending: config.orderAsc ?? false });
    }

    // Apply limit/offset
    if (params.limit) {
      query = query.limit(params.limit);
    }
    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 100) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  private calculateTotals(data: any[], aggregateColumns: string[]): Record<string, number> {
    const totals: Record<string, number> = {};

    for (const col of aggregateColumns) {
      totals[col] = data.reduce((sum, row) => sum + (Number(row[col]) || 0), 0);
    }

    return totals;
  }

  // =============================================
  // SAVED REPORTS
  // =============================================

  async getSavedReports(propertyId: string, userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('saved_reports')
      .select(`
        *,
        template:report_templates(name, category)
      `)
      .eq('property_id', propertyId)
      .or(`created_by.eq.${userId},is_public.eq.true`)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async saveReport(propertyId: string, userId: string, data: {
    name: string;
    description?: string;
    templateId: string;
    params: any;
    isPublic?: boolean;
  }): Promise<any> {
    const id = uuidv4();

    const { data: saved, error } = await this.supabase
      .from('saved_reports')
      .insert({
        id,
        property_id: propertyId,
        name: data.name,
        description: data.description || null,
        template_id: data.templateId,
        params: data.params,
        is_public: data.isPublic || false,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return saved;
  }

  async updateSavedReport(reportId: string, userId: string, data: Partial<{
    name: string;
    description: string;
    params: any;
    isPublic: boolean;
  }>): Promise<any> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.params !== undefined) updateData.params = data.params;
    if (data.isPublic !== undefined) updateData.is_public = data.isPublic;

    const { data: saved, error } = await this.supabase
      .from('saved_reports')
      .update(updateData)
      .eq('id', reportId)
      .eq('created_by', userId)
      .select()
      .single();

    if (error) throw error;
    return saved;
  }

  async deleteSavedReport(reportId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('saved_reports')
      .delete()
      .eq('id', reportId)
      .eq('created_by', userId);

    if (error) throw error;
  }

  // =============================================
  // KPI CALCULATIONS
  // Controller calls: getKPIs(propertyId, dateRange, kpiCodes?)
  // =============================================

  async getKPIs(propertyId: string, dateRange: DateRange, kpiCodes?: string[]): Promise<any[]> {
    let query = this.supabase
      .from('kpi_definitions')
      .select('*')
      .or(`property_id.eq.${propertyId},is_standard.eq.true`)
      .eq('is_active', true);

    if (kpiCodes && kpiCodes.length > 0) {
      query = query.in('code', kpiCodes);
    }

    const { data: definitions, error: defError } = await query;

    if (defError) throw defError;

    const kpis = [];
    for (const def of (definitions || [])) {
      const value = await this.calculateKPIValue(propertyId, def, dateRange);

      // Get target if exists
      const { data: targetData } = await this.supabase
        .from('kpi_targets')
        .select('target_value')
        .eq('property_id', propertyId)
        .eq('kpi_code', def.code)
        .lte('period_start', dateRange.end.toISOString())
        .gte('period_end', dateRange.start.toISOString())
        .limit(1)
        .single();

      const target = targetData?.target_value;
      const variance = target ? ((value - target) / target) * 100 : null;

      kpis.push({
        code: def.code,
        name: def.name,
        category: def.category,
        value,
        target,
        variance,
        unit: def.unit,
        format: def.display_format
      });
    }

    return kpis;
  }

  private async calculateKPIValue(
    propertyId: string,
    def: any,
    dateRange: DateRange
  ): Promise<number> {
    const startStr = dateRange.start.toISOString();
    const endStr = dateRange.end.toISOString();

    switch (def.calculation_type) {
      case 'occupancy_rate': {
        const { data: rooms } = await this.supabase
          .from('rooms')
          .select('id')
          .eq('property_id', propertyId)
          .eq('is_active', true);

        const totalRooms = rooms?.length || 1;
        const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const totalRoomNights = totalRooms * days;

        const { count } = await this.supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .filter('metadata->>check_in_date', 'gte', startStr)
          .filter('metadata->>check_out_date', 'lte', endStr);

        const occupiedNights = count || 0;
        return totalRoomNights > 0 ? (occupiedNights / totalRoomNights) * 100 : 0;
      }

      case 'adr': {
        const { data: bookings } = await this.supabase
          .from('transactions')
          .select('amount, metadata')
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .filter('metadata->>check_in_date', 'gte', startStr)
          .filter('metadata->>check_out_date', 'lte', endStr);

        if (!bookings || bookings.length === 0) return 0;
        const totalRevenue = bookings.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
        const totalNights = bookings.reduce((sum: number, b: any) => sum + ((b.metadata as any)?.nights || 1), 0);
        return totalNights > 0 ? totalRevenue / totalNights : 0;
      }

      case 'revpar': {
        const { data: rooms } = await this.supabase
          .from('rooms')
          .select('id')
          .eq('property_id', propertyId)
          .eq('is_active', true);

        const totalRooms = rooms?.length || 1;
        const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const totalRoomNights = totalRooms * days;

        const { data: bookings } = await this.supabase
          .from('transactions')
          .select('amount')
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .filter('metadata->>check_in_date', 'gte', startStr)
          .filter('metadata->>check_out_date', 'lte', endStr);

        const totalRevenue = (bookings || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
        return totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;
      }

      case 'total_revenue': {
        const { data: bookings } = await this.supabase
          .from('transactions')
          .select('amount')
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        return (bookings || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
      }

      case 'booking_count': {
        const { count } = await this.supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        return count || 0;
      }

      case 'cancellation_rate': {
        const { count: total } = await this.supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        const { count: cancelled } = await this.supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .eq('status', 'cancelled')
          .gte('created_at', startStr)
          .lte('created_at', endStr);

        return (total || 0) > 0 ? ((cancelled || 0) / (total || 1)) * 100 : 0;
      }

      case 'average_stay': {
        const { data: bookings } = await this.supabase
          .from('transactions')
          .select('metadata')
          .eq('engine_type', 'time_exclusive_reservation')
          .eq('property_id', propertyId)
          .in('status', ['confirmed', 'checked_in', 'checked_out'])
          .filter('metadata->>check_in_date', 'gte', startStr)
          .filter('metadata->>check_out_date', 'lte', endStr);

        if (!bookings || bookings.length === 0) return 0;
        const totalNights = bookings.reduce((sum: number, b: any) => sum + ((b.metadata as any)?.nights || 0), 0);
        return totalNights / bookings.length;
      }

      default:
        return 0;
    }
  }

  // Controller calls: setKPITarget(propertyId, kpiCode, periodType, periodStart, periodEnd, targetValue, stretchTarget, notes, userId)
  async setKPITarget(
    propertyId: string,
    kpiCode: string,
    periodType: string,
    periodStart: Date,
    periodEnd: Date,
    targetValue: number,
    stretchTarget?: number,
    notes?: string,
    userId?: string
  ): Promise<any> {
    const id = uuidv4();

    const { data: target, error } = await this.supabase
      .from('kpi_targets')
      .insert({
        id,
        property_id: propertyId,
        kpi_code: kpiCode,
        period_type: periodType,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        target_value: targetValue,
        stretch_target: stretchTarget || null,
        notes: notes || null,
        created_by: userId || null
      })
      .select()
      .single();

    if (error) throw error;
    return target;
  }

  // =============================================
  // FINANCIAL REPORTS
  // Controller calls: generateRevenueReport(propertyId, dateRange, groupBy)
  // =============================================

  async generateRevenueReport(propertyId: string, dateRange: DateRange, groupBy: 'day' | 'week' | 'month' = 'day'): Promise<any> {
    const { data: bookings, error } = await this.supabase
      .from('transactions')
      .select('amount, metadata, created_at')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());

    if (error) throw error;

    const totalRevenue = (bookings || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
    const roomRevenue = totalRevenue; // amount IS the room revenue in unified model
    const bookingCount = bookings?.length || 0;
    const avgBookingValue = bookingCount > 0 ? totalRevenue / bookingCount : 0;

    // Group by date based on groupBy param
    const revenueByPeriod: Record<string, number> = {};
    for (const booking of (bookings || [])) {
      let periodKey: string;
      const bookingDate = new Date(booking.created_at);

      switch (groupBy) {
        case 'week':
          periodKey = dayjs(bookingDate).startOf('week').format('YYYY-MM-DD');
          break;
        case 'month':
          periodKey = dayjs(bookingDate).format('YYYY-MM');
          break;
        default: // day
          periodKey = dayjs(bookingDate).format('YYYY-MM-DD');
      }

      revenueByPeriod[periodKey] = (revenueByPeriod[periodKey] || 0) + ((booking as any).amount || 0);
    }

    return {
      summary: {
        totalRevenue,
        roomRevenue,
        bookingCount,
        avgBookingValue
      },
      breakdown: Object.entries(revenueByPeriod)
        .map(([period, revenue]) => ({ period, revenue }))
        .sort((a, b) => a.period.localeCompare(b.period))
    };
  }

  async generateOccupancyReport(propertyId: string, dateRange: DateRange): Promise<any> {
    const { data: rooms } = await this.supabase
      .from('rooms')
      .select('id, room_type_id')
      .eq('property_id', propertyId)
      .eq('is_active', true);

    const { data: roomTypes } = await this.supabase
      .from('room_types')
      .select('id, name')
      .eq('property_id', propertyId);

    const totalRooms = rooms?.length || 1;
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { data: bookings } = await this.supabase
      .from('transactions')
      .select('metadata')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .filter('metadata->>check_in_date', 'gte', dateRange.start.toISOString())
      .filter('metadata->>check_out_date', 'lte', dateRange.end.toISOString());

    // FIX: Iteration 15 - Count actual room-nights, not booking records
    // A booking spanning 5 nights should count as 5 occupied nights, not 1
    const occupiedNights = (bookings || []).reduce((sum: number, b: any) => {
      const meta = b.metadata as Record<string, unknown> | null;
      const checkIn = new Date(String(meta?.check_in_date || ''));
      const checkOut = new Date(String(meta?.check_out_date || ''));
      const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
      return sum + nights;
    }, 0);
    const totalRoomNights = totalRooms * days;
    const overallOccupancy = totalRoomNights > 0 ? (occupiedNights / totalRoomNights) * 100 : 0;

    // Occupancy by room type
    const occupancyByType: Record<string, { occupied: number; total: number }> = {};
    for (const rt of (roomTypes || [])) {
      const typeRooms = (rooms || []).filter(r => r.room_type_id === rt.id);
      const typeBookings = (bookings || []).filter((b: any) => {
        const meta = b.metadata as Record<string, unknown> | null;
        return typeRooms.some(r => r.id === meta?.unit_id);
      });
      // FIX: Iteration 15 - Same room-night calculation for per-type breakdown
      const typeNights = typeBookings.reduce((sum: number, b: any) => {
        const meta = b.metadata as Record<string, unknown> | null;
        const checkIn = new Date(String(meta?.check_in_date || ''));
        const checkOut = new Date(String(meta?.check_out_date || ''));
        return sum + Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
      }, 0);
      occupancyByType[rt.name] = {
        occupied: typeNights,
        total: typeRooms.length * days
      };
    }

    return {
      summary: {
        totalRooms,
        totalRoomNights,
        occupiedNights,
        overallOccupancy: Math.round(overallOccupancy * 100) / 100
      },
      byRoomType: Object.entries(occupancyByType).map(([name, data]) => ({
        roomType: name,
        occupancy: data.total > 0 ? Math.round((data.occupied / data.total) * 10000) / 100 : 0
      }))
    };
  }

  async generateChannelPerformanceReport(propertyId: string, dateRange: DateRange): Promise<any> {
    const { data: bookings, error } = await this.supabase
      .from('transactions')
      .select('amount, metadata')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());

    if (error) throw error;

    const channelData: Record<string, { count: number; revenue: number }> = {};
    for (const booking of (bookings || []) as any[]) {
      const meta = booking.metadata as Record<string, unknown> | null;
      const channel = (meta?.source as string) || 'direct';
      if (!channelData[channel]) {
        channelData[channel] = { count: 0, revenue: 0 };
      }
      channelData[channel].count++;
      channelData[channel].revenue += (booking as any).amount || 0;
    }

    const totalBookings = bookings?.length || 0;
    const totalRevenue = (bookings || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

    return {
      summary: { totalBookings, totalRevenue },
      byChannel: Object.entries(channelData).map(([channel, data]) => ({
        channel,
        bookings: data.count,
        revenue: data.revenue,
        shareOfBookings: totalBookings > 0 ? Math.round((data.count / totalBookings) * 10000) / 100 : 0,
        shareOfRevenue: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 10000) / 100 : 0
      }))
    };
  }

  // =============================================
  // OPERATIONAL REPORTS
  // Controller calls: generateHousekeepingReport(propertyId, date) where date is a Date
  // =============================================

  async generateHousekeepingReport(propertyId: string, reportDate: Date): Promise<any> {
    const dayStart = dayjs(reportDate).startOf('day').toISOString();
    const dayEnd = dayjs(reportDate).endOf('day').toISOString();

    const { data: tasks } = await this.supabase
      .from('housekeeping_tasks')
      .select('*')
      .eq('property_id', propertyId)
      .gte('scheduled_date', dayStart)
      .lte('scheduled_date', dayEnd);

    const total = tasks?.length || 0;
    const completed = (tasks || []).filter(t => t.status === 'completed').length;
    const pending = (tasks || []).filter(t => t.status === 'pending').length;
    const inProgress = (tasks || []).filter(t => t.status === 'in_progress').length;

    // Calculate average completion time
    const completedTasks = (tasks || []).filter(t => t.completed_at && t.started_at);
    let avgCompletionTime = 0;
    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, t) => {
        const start = new Date(t.started_at).getTime();
        const end = new Date(t.completed_at).getTime();
        return sum + (end - start);
      }, 0);
      avgCompletionTime = totalTime / completedTasks.length / (1000 * 60); // minutes
    }

    // Group by assigned staff
    const byStaff: Record<string, number> = {};
    for (const task of (tasks || [])) {
      const staff = task.assigned_to || 'unassigned';
      byStaff[staff] = (byStaff[staff] || 0) + 1;
    }

    return {
      date: dayjs(reportDate).format('YYYY-MM-DD'),
      summary: {
        total,
        completed,
        pending,
        inProgress,
        completionRate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
        avgCompletionTimeMinutes: Math.round(avgCompletionTime)
      },
      byStaff: Object.entries(byStaff).map(([staff, count]) => ({
        staffId: staff,
        taskCount: count
      }))
    };
  }

  async generateMaintenanceReport(propertyId: string, dateRange: DateRange): Promise<any> {
    const { data: tasks } = await this.supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('property_id', propertyId)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());

    const total = tasks?.length || 0;
    const completed = (tasks || []).filter(t => t.status === 'completed').length;
    const open = (tasks || []).filter(t => ['pending', 'in_progress'].includes(t.status)).length;

    // By priority
    const byPriority: Record<string, number> = {};
    for (const task of (tasks || [])) {
      const priority = task.priority || 'normal';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    }

    // By category
    const byCategory: Record<string, number> = {};
    for (const task of (tasks || [])) {
      const category = task.category || 'general';
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    return {
      summary: {
        total,
        completed,
        open,
        completionRate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0
      },
      byPriority: Object.entries(byPriority).map(([priority, count]) => ({
        priority,
        count
      })),
      byCategory: Object.entries(byCategory).map(([category, count]) => ({
        category,
        count
      }))
    };
  }

  // =============================================
  // SCHEDULED REPORTS
  // =============================================

  async getScheduledReports(propertyId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('report_scheduled')
      .select(`
        *,
        template:report_templates(name, category)
      `)
      .eq('property_id', propertyId)
      .order('next_run_at');

    if (error) throw error;
    return data || [];
  }

  async createScheduledReport(propertyId: string, userId: string, data: {
    name: string;
    templateId: string;
    params: any;
    frequency: string;
    cronExpression?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    hour?: number;
    minute?: number;
    timezone?: string;
    exportFormat: string;
    recipients: { type: string; id?: string; address?: string }[];
    emailSubjectTemplate?: string;
    emailBodyTemplate?: string;
  }): Promise<any> {
    const id = uuidv4();
    const nextRunAt = this.calculateNextRunTime(data.frequency, {
      cronExpression: data.cronExpression,
      dayOfWeek: data.dayOfWeek,
      dayOfMonth: data.dayOfMonth,
      hour: data.hour ?? 8,
      minute: data.minute ?? 0,
      timezone: data.timezone || 'UTC'
    });

    const { data: scheduled, error } = await this.supabase
      .from('report_scheduled')
      .insert({
        id,
        property_id: propertyId,
        name: data.name,
        template_id: data.templateId,
        params: data.params,
        frequency: data.frequency,
        cron_expression: data.cronExpression || null,
        day_of_week: data.dayOfWeek,
        day_of_month: data.dayOfMonth,
        hour: data.hour ?? 8,
        minute: data.minute ?? 0,
        timezone: data.timezone || 'UTC',
        export_format: data.exportFormat,
        recipients: data.recipients,
        email_subject_template: data.emailSubjectTemplate || null,
        email_body_template: data.emailBodyTemplate || null,
        next_run_at: nextRunAt.toISOString(),
        is_active: true,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return scheduled;
  }

  private calculateNextRunTime(frequency: string, config: {
    cronExpression?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    hour: number;
    minute: number;
    timezone: string;
  }): Date {
    const now = new Date();
    let next = new Date(now);

    next.setHours(config.hour, config.minute, 0, 0);

    switch (frequency) {
      case 'daily':
        if (next <= now) {
          next = dayjs(next).add(1, 'day').toDate();
        }
        break;

      case 'weekly':
        const targetDay = config.dayOfWeek ?? 1;
        while (next.getDay() !== targetDay || next <= now) {
          next = dayjs(next).add(1, 'day').toDate();
        }
        break;

      case 'monthly':
        const targetDate = config.dayOfMonth ?? 1;
        next.setDate(targetDate);
        if (next <= now) {
          next = dayjs(next).add(1, 'month').toDate();
          next.setDate(targetDate);
        }
        break;

      case 'yearly':
        if (next <= now) {
          next = dayjs(next).add(1, 'year').toDate();
        }
        break;

      default:
        next = dayjs(next).add(1, 'day').toDate();
    }

    return next;
  }

  async updateScheduledReport(reportId: string, data: Partial<{
    name: string;
    params: any;
    frequency: string;
    cronExpression: string;
    dayOfWeek: number;
    dayOfMonth: number;
    hour: number;
    minute: number;
    timezone: string;
    exportFormat: string;
    recipients: any[];
    emailSubjectTemplate: string;
    emailBodyTemplate: string;
    isActive: boolean;
  }>): Promise<any> {
    const updateData: any = { updated_at: new Date().toISOString() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.params !== undefined) updateData.params = data.params;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.cronExpression !== undefined) updateData.cron_expression = data.cronExpression;
    if (data.dayOfWeek !== undefined) updateData.day_of_week = data.dayOfWeek;
    if (data.dayOfMonth !== undefined) updateData.day_of_month = data.dayOfMonth;
    if (data.hour !== undefined) updateData.hour = data.hour;
    if (data.minute !== undefined) updateData.minute = data.minute;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.exportFormat !== undefined) updateData.export_format = data.exportFormat;
    if (data.recipients !== undefined) updateData.recipients = data.recipients;
    if (data.emailSubjectTemplate !== undefined) updateData.email_subject_template = data.emailSubjectTemplate;
    if (data.emailBodyTemplate !== undefined) updateData.email_body_template = data.emailBodyTemplate;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    // Recalculate next run time if schedule changed
    if (data.frequency || data.hour !== undefined || data.minute !== undefined ||
      data.dayOfWeek !== undefined || data.dayOfMonth !== undefined) {
      const { data: current } = await this.supabase
        .from('report_scheduled')
        .select('*')
        .eq('id', reportId)
        .single();

      if (current) {
        const nextRun = this.calculateNextRunTime(
          data.frequency || current.frequency,
          {
            cronExpression: data.cronExpression ?? current.cron_expression,
            dayOfWeek: data.dayOfWeek ?? current.day_of_week,
            dayOfMonth: data.dayOfMonth ?? current.day_of_month,
            hour: data.hour ?? current.hour,
            minute: data.minute ?? current.minute,
            timezone: data.timezone ?? current.timezone
          }
        );
        updateData.next_run_at = nextRun.toISOString();
      }
    }

    const { data: scheduled, error } = await this.supabase
      .from('report_scheduled')
      .update(updateData)
      .eq('id', reportId)
      .select()
      .single();

    if (error) throw error;
    return scheduled;
  }

  async deleteScheduledReport(reportId: string): Promise<void> {
    const { error } = await this.supabase
      .from('report_scheduled')
      .delete()
      .eq('id', reportId);

    if (error) throw error;
  }

  async executeScheduledReport(reportId: string): Promise<void> {
    const { data: scheduled, error } = await this.supabase
      .from('report_scheduled')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error || !scheduled) {
      throw new Error('Scheduled report not found');
    }

    try {
      // Determine date range
      const dateRangeParams = this.getDateRangeForType(scheduled.frequency);
      const params = { ...scheduled.params, dateRange: dateRangeParams };

      // Execute the report
      const result = await this.executeReport(
        scheduled.property_id,
        scheduled.template_id,
        params,
        scheduled.created_by
      );

      // Export
      const exportUrl = await this.exportReport(result, scheduled.export_format, scheduled.name);

      // Deliver to recipients
      for (const recipient of (scheduled.recipients || [])) {
        await this.deliverReport(scheduled, exportUrl, scheduled.export_format, recipient);
      }

      // Update last run and calculate next run
      const nextRun = this.calculateNextRunTime(scheduled.frequency, {
        cronExpression: scheduled.cron_expression,
        dayOfWeek: scheduled.day_of_week,
        dayOfMonth: scheduled.day_of_month,
        hour: scheduled.hour,
        minute: scheduled.minute,
        timezone: scheduled.timezone
      });

      await this.supabase
        .from('report_scheduled')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRun.toISOString(),
          last_run_status: 'success'
        })
        .eq('id', reportId);

    } catch (err: any) {
      await this.supabase
        .from('report_scheduled')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'failed',
          last_run_error: err.message
        })
        .eq('id', reportId);

      throw err;
    }
  }

  private getDateRangeForType(frequency: string): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (frequency) {
      case 'daily':
        start = dayjs(now).subtract(1, 'day').toDate();
        end = dayjs(now).subtract(1, 'day').toDate();
        break;
      case 'weekly':
        start = dayjs(now).subtract(7, 'day').startOf('week').toDate();
        end = dayjs(now).subtract(7, 'day').endOf('week').toDate();
        break;
      case 'monthly':
        start = dayjs(now).subtract(1, 'month').startOf('month').toDate();
        end = dayjs(now).subtract(1, 'month').endOf('month').toDate();
        break;
      case 'yearly':
        const lastYear = now.getFullYear() - 1;
        start = dayjs(new Date(lastYear, 0, 1)).toDate();
        end = dayjs(new Date(lastYear, 11, 31)).toDate();
        break;
      default:
        start = dayjs(now).subtract(1, 'day').toDate();
        end = now;
    }

    return { start, end };
  }

  // =============================================
  // EXPORT FUNCTIONS
  // =============================================

  async exportReport(result: ReportResult, format: string, name: string): Promise<string> {
    const filename = `${name.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD_HHmmss')}`;

    switch (format.toLowerCase()) {
      case 'pdf':
        return this.exportToPDF(result, filename);
      case 'excel':
      case 'xlsx':
        return this.exportToExcel(result, filename);
      case 'csv':
        return this.exportToCSV(result, filename);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportToPDF(result: ReportResult, filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);

        const path = `reports/${filename}.pdf`;
        const { error } = await this.supabase.storage
          .from('exports')
          .upload(path, buffer, { contentType: 'application/pdf' });

        if (error) {
          reject(error);
        } else {
          const { data: urlData } = this.supabase.storage
            .from('exports')
            .getPublicUrl(path);
          resolve(urlData.publicUrl);
        }
      });

      doc.fontSize(20).text(filename.replace(/_/g, ' '), { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${result.metadata.generatedAt.toISOString()}`);
      doc.text(`Rows: ${result.metadata.rowCount}`);
      doc.moveDown();

      if (result.data.length > 0) {
        const headers = Object.keys(result.data[0]);
        doc.fontSize(8);

        doc.font('Helvetica-Bold');
        doc.text(headers.join('  |  '));
        doc.font('Helvetica');
        doc.moveDown(0.5);

        for (const row of result.data.slice(0, 100)) {
          const values = headers.map(h => String((row as any)[h] ?? ''));
          doc.text(values.join('  |  '));
        }

        if (result.data.length > 100) {
          doc.moveDown();
          doc.text(`... and ${result.data.length - 100} more rows`);
        }
      }

      doc.end();
    });
  }

  private async exportToExcel(result: ReportResult, filename: string): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');

    if (result.data.length > 0) {
      const headers = Object.keys(result.data[0]);
      sheet.addRow(headers);

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      for (const row of result.data) {
        sheet.addRow(headers.map(h => (row as any)[h]));
      }

      if (result.totals && Object.keys(result.totals).length > 0) {
        sheet.addRow([]);
        sheet.addRow(['Totals']);
        for (const [key, value] of Object.entries(result.totals)) {
          sheet.addRow([key, value]);
        }
      }

      sheet.columns.forEach(column => {
        column.width = 15;
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const path = `reports/${filename}.xlsx`;
    const { error } = await this.supabase.storage
      .from('exports')
      .upload(path, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

    if (error) throw error;

    const { data: urlData } = this.supabase.storage
      .from('exports')
      .getPublicUrl(path);

    return urlData.publicUrl;
  }

  private async exportToCSV(result: ReportResult, filename: string): Promise<string> {
    if (result.data.length === 0) {
      throw new Error('No data to export');
    }

    const parser = new Parser();
    const csv = parser.parse(result.data);

    const path = `reports/${filename}.csv`;
    const { error } = await this.supabase.storage
      .from('exports')
      .upload(path, Buffer.from(csv), { contentType: 'text/csv' });

    if (error) throw error;

    const { data: urlData } = this.supabase.storage
      .from('exports')
      .getPublicUrl(path);

    return urlData.publicUrl;
  }

  // =============================================
  // DELIVERY FUNCTIONS
  // =============================================

  private async deliverReport(
    scheduled: any,
    exportUrl: string,
    format: string,
    recipient: { type: string; id?: string; address?: string }
  ): Promise<void> {
    const deliveryId = uuidv4();

    try {
      let recipientAddress = recipient.address;

      if (recipient.type === 'user' && recipient.id) {
        const { data: user } = await this.supabase
          .from('users')
          .select('email')
          .eq('id', recipient.id)
          .single();

        recipientAddress = user?.email;
      }

      if (!recipientAddress) {
        throw new Error('No recipient address');
      }

      if (this.emailTransporter) {
        const subject = scheduled.email_subject_template
          ? this.interpolateTemplate(scheduled.email_subject_template, scheduled)
          : `Report: ${scheduled.name}`;

        const body = scheduled.email_body_template
          ? this.interpolateTemplate(scheduled.email_body_template, scheduled)
          : `Your scheduled report "${scheduled.name}" is ready.\n\nDownload: ${exportUrl}`;

        await this.emailTransporter.sendMail({
          from: process.env.SMTP_FROM || 'reports@v2resort.com',
          to: recipientAddress,
          subject,
          text: body,
          html: `<p>${body.replace(/\n/g, '<br>')}</p>`
        });
      }

      await this.supabase.from('report_delivery_log').insert({
        id: deliveryId,
        scheduled_report_id: scheduled.id,
        delivery_method: 'email',
        recipient_type: recipient.type,
        recipient_address: recipientAddress,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    } catch (error: any) {
      await this.supabase.from('report_delivery_log').insert({
        id: deliveryId,
        scheduled_report_id: scheduled.id,
        delivery_method: 'email',
        recipient_type: recipient.type,
        recipient_address: recipient.address || '',
        status: 'failed',
        error_message: error.message
      });

      throw error;
    }
  }

  private interpolateTemplate(template: string, context: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] ?? match;
    });
  }

  // =============================================
  // DASHBOARDS
  // =============================================

  async getDashboards(propertyId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('report_dashboards')
      .select('*')
      .eq('property_id', propertyId)
      .order('is_default', { ascending: false })
      .order('name');

    if (error) throw error;

    // Get widget counts
    const dashboards = data || [];
    for (const d of dashboards) {
      const { count } = await this.supabase
        .from('dashboard_widgets')
        .select('*', { count: 'exact', head: true })
        .eq('dashboard_id', d.id);
      d.widget_count = count || 0;
    }

    return dashboards;
  }

  async getDashboardWithWidgets(dashboardId: string): Promise<any> {
    const { data: dashboard, error } = await this.supabase
      .from('report_dashboards')
      .select('*')
      .eq('id', dashboardId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!dashboard) return null;

    const { data: widgets } = await this.supabase
      .from('dashboard_widgets')
      .select(`
        *,
        template:report_templates(name),
        saved_report:saved_reports(name)
      `)
      .eq('dashboard_id', dashboardId)
      .order('position_y')
      .order('position_x');

    return { ...dashboard, widgets: widgets || [] };
  }

  async createDashboard(propertyId: string, data: {
    name: string;
    description?: string;
    layoutType?: string;
    layoutConfig?: any;
    isDefault?: boolean;
    isPublic?: boolean;
    allowedRoles?: string[];
  }, userId: string): Promise<any> {
    if (data.isDefault) {
      await this.supabase
        .from('report_dashboards')
        .update({ is_default: false })
        .eq('property_id', propertyId);
    }

    const id = uuidv4();
    const { data: dashboard, error } = await this.supabase
      .from('report_dashboards')
      .insert({
        id,
        property_id: propertyId,
        name: data.name,
        description: data.description || null,
        layout_type: data.layoutType || 'grid',
        layout_config: data.layoutConfig || { columns: 12, rowHeight: 50 },
        is_default: data.isDefault || false,
        is_public: data.isPublic || false,
        allowed_roles: data.allowedRoles || ['admin', 'manager'],
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return dashboard;
  }

  async addWidget(dashboardId: string, data: {
    widgetType: string;
    title?: string;
    config: any;
    templateId?: string;
    savedReportId?: string;
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
    autoRefresh?: boolean;
    refreshIntervalSeconds?: number;
  }): Promise<any> {
    const id = uuidv4();
    const { data: widget, error } = await this.supabase
      .from('dashboard_widgets')
      .insert({
        id,
        dashboard_id: dashboardId,
        widget_type: data.widgetType,
        title: data.title || null,
        config: data.config,
        template_id: data.templateId || null,
        saved_report_id: data.savedReportId || null,
        position_x: data.positionX || 0,
        position_y: data.positionY || 0,
        width: data.width || 4,
        height: data.height || 3,
        auto_refresh: data.autoRefresh || false,
        refresh_interval_seconds: data.refreshIntervalSeconds || 300
      })
      .select()
      .single();

    if (error) throw error;
    return widget;
  }

  async updateWidgetLayout(widgetId: string, layout: {
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('dashboard_widgets')
      .update({
        position_x: layout.positionX,
        position_y: layout.positionY,
        width: layout.width,
        height: layout.height,
        updated_at: new Date().toISOString()
      })
      .eq('id', widgetId);

    if (error) throw error;
  }

  async deleteWidget(widgetId: string): Promise<void> {
    const { error } = await this.supabase
      .from('dashboard_widgets')
      .delete()
      .eq('id', widgetId);

    if (error) throw error;
  }

  // =============================================
  // DATA SNAPSHOTS
  // =============================================

  async createDailySnapshot(propertyId: string, date: Date = new Date()): Promise<void> {
    const snapshotDate = dayjs(date).format('YYYY-MM-DD');

    const kpis = await this.getKPIs(propertyId, {
      start: new Date(snapshotDate),
      end: new Date(snapshotDate)
    });

    const { data: bookings } = await this.supabase
      .from('transactions')
      .select('amount, status')
      .eq('engine_type', 'time_exclusive_reservation')
      .eq('property_id', propertyId)
      .gte('created_at', `${snapshotDate}T00:00:00`)
      .lte('created_at', `${snapshotDate}T23:59:59`);

    const metrics = {
      total_bookings: bookings?.length || 0,
      total_revenue: (bookings || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0),
      check_ins: (bookings || []).filter(b => b.status === 'checked_in').length,
      check_outs: (bookings || []).filter(b => b.status === 'checked_out').length,
      cancellations: (bookings || []).filter(b => b.status === 'cancelled').length
    };

    const snapshotData = {
      kpis: kpis.reduce((acc, kpi) => {
        acc[kpi.code] = kpi.value;
        return acc;
      }, {} as Record<string, number>),
      metrics
    };

    const { error } = await this.supabase
      .from('data_snapshots')
      .upsert({
        id: uuidv4(),
        property_id: propertyId,
        snapshot_type: 'daily_summary',
        snapshot_date: snapshotDate,
        data: snapshotData
      }, {
        onConflict: 'property_id,snapshot_type,snapshot_date'
      });

    if (error) throw error;
  }

  async lockMonthSnapshot(propertyId: string, month: Date, userId: string): Promise<void> {
    const monthStart = dayjs(month).startOf('month').format('YYYY-MM-DD');
    const monthEnd = dayjs(month).endOf('month').format('YYYY-MM-DD');

    const { error } = await this.supabase
      .from('data_snapshots')
      .update({
        is_locked: true,
        locked_by: userId,
        locked_at: new Date().toISOString()
      })
      .eq('property_id', propertyId)
      .gte('snapshot_date', monthStart)
      .lte('snapshot_date', monthEnd);

    if (error) throw error;
  }

  // =============================================
  // SCHEDULER
  // =============================================

  startScheduler(): void {
    cron.schedule('*/5 * * * *', async () => {
      try {
        const { data: dueReports } = await this.supabase
          .from('report_scheduled')
          .select('id')
          .eq('is_active', true)
          .lte('next_run_at', new Date().toISOString())
          .order('next_run_at')
          .limit(10);

        for (const report of (dueReports || [])) {
          try {
            await this.executeScheduledReport(report.id);
          } catch (error) {
            logger.error(`Failed to execute scheduled report ${report.id}:`, error);
          }
        }
      } catch (error) {
        logger.error('Scheduler error:', error);
      }
    });

    logger.info('Report scheduler started (every 5 minutes)');
  }
}

export const reportingService = new ReportingService();
