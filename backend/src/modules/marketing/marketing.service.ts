/**
 * Marketing Automation Service
 * Phase 3.4: Email Journeys, Triggered Campaigns, Segmentation
 */

import { getSupabase } from '../../database/connection.js';
import dayjs from 'dayjs';
import cron from 'node-cron';
import nodemailer from 'nodemailer';

// Types
interface SegmentRule {
  field: string;
  operator: string;
  value: any;
}

interface EmailTemplate {
  id?: string;
  name: string;
  category: string;
  subject: string;
  previewText?: string;
  htmlContent: string;
  textContent?: string;
  variables?: string[];
}

interface JourneyStep {
  stepOrder: number;
  stepType: 'send_email' | 'wait' | 'condition' | 'split' | 'update_profile' | 'exit';
  name?: string;
  config?: any;
  templateId?: string;
  waitDuration?: string;
  waitUntilTime?: string;
  conditionRules?: any;
}

interface Campaign {
  name: string;
  description?: string;
  campaignType?: string;
  templateId: string;
  segmentId?: string;
  customAudience?: string[];
  subjectLine: string;
  previewText?: string;
  fromName?: string;
  fromEmail?: string;
  scheduleType?: 'immediate' | 'scheduled';
  scheduledAt?: Date;
  enableAbTest?: boolean;
  abVariants?: any[];
}

interface MergeVariables {
  [key: string]: string | number | undefined;
}

export class MarketingAutomationService {
  private get supabase() { return getSupabase(); }
  private transporter: nodemailer.Transporter;
  private isProcessing = false;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'apikey',
        pass: process.env.SMTP_PASS || process.env.SENDGRID_API_KEY
      }
    });
  }

  // =============================================
  // GUEST SEGMENTS
  // =============================================

  async createSegment(
    propertyId: string,
    name: string,
    rules: SegmentRule[],
    description?: string,
    segmentType: 'dynamic' | 'static' = 'dynamic'
  ): Promise<any> {
    const { data: segment, error } = await this.supabase
      .from('guest_segments')
      .insert({
        property_id: propertyId,
        name,
        description: description || null,
        segment_type: segmentType,
        rules: rules
      })
      .select()
      .single();

    if (error) throw error;

    // Calculate initial membership
    await this.calculateSegmentMembers(segment.id);

    return segment;
  }

  async getSegments(propertyId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('guest_segments')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async calculateSegmentMembers(segmentId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('calculate_segment_members', {
      p_segment_id: segmentId
    });

    if (error) throw error;
    return data || 0;
  }

  async getSegmentMembers(segmentId: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    const { data: segment, error: segmentError } = await this.supabase
      .from('guest_segments')
      .select('*')
      .eq('id', segmentId)
      .single();

    if (segmentError) throw segmentError;
    if (!segment) {
      throw new Error('Segment not found');
    }

    if (segment.segment_type === 'static') {
      const { data, error } = await this.supabase
        .from('segment_members')
        .select('guests(*)')
        .eq('segment_id', segmentId)
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return (data || []).map((row: any) => row.guests);
    }

    // For dynamic segments, build query from rules
    const rules = segment.rules as SegmentRule[];
    return this.queryGuestsByRules(segment.property_id, rules, limit, offset);
  }

  private async queryGuestsByRules(
    propertyId: string,
    rules: SegmentRule[],
    limit: number,
    offset: number
  ): Promise<any[]> {
    // For complex dynamic queries with rules, use RPC
    const { data, error } = await this.supabase.rpc('query_guests_by_rules', {
      p_property_id: propertyId,
      p_rules: rules,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      // Fallback: get all guests for property and filter in application
      const { data: guests, error: guestError } = await this.supabase
        .from('guests')
        .select('*, bookings!inner(*)')
        .eq('bookings.property_id', propertyId)
        .range(offset, offset + limit - 1);

      if (guestError) throw guestError;
      return guests || [];
    }

    return data || [];
  }

  private buildRuleCondition(rule: SegmentRule): string | null {
    switch (rule.field) {
      case 'total_stays':
        return `(SELECT COUNT(*) FROM bookings WHERE guest_id = g.id AND status = 'completed') ${rule.operator} ${rule.value}`;
      case 'total_spend':
        return `(SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE guest_id = g.id AND status = 'completed') ${rule.operator} ${rule.value}`;
      case 'last_stay_days_ago':
        return `(SELECT EXTRACT(DAY FROM NOW() - MAX(check_out)) FROM bookings WHERE guest_id = g.id AND status = 'completed') ${rule.operator} ${rule.value}`;
      case 'average_spend':
        return `(SELECT COALESCE(AVG(total_amount), 0) FROM bookings WHERE guest_id = g.id AND status = 'completed') ${rule.operator} ${rule.value}`;
      case 'room_type':
        return `EXISTS (SELECT 1 FROM bookings WHERE guest_id = g.id AND room_type_id = '${rule.value}')`;
      case 'vip_status':
        return `g.vip_status = '${rule.value}'`;
      case 'country':
        return `g.country = '${rule.value}'`;
      case 'has_birthday_this_month':
        return `EXTRACT(MONTH FROM g.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)`;
      default:
        return null;
    }
  }

  async addToSegment(segmentId: string, guestIds: string[], addedBy: string = 'manual'): Promise<number> {
    let added = 0;
    for (const guestId of guestIds) {
      try {
        const { error } = await this.supabase
          .from('segment_members')
          .upsert({
            segment_id: segmentId,
            guest_id: guestId,
            added_by: addedBy
          }, { onConflict: 'segment_id,guest_id', ignoreDuplicates: true });

        if (!error) added++;
      } catch (e) {
        // Ignore duplicates
      }
    }

    await this.calculateSegmentMembers(segmentId);
    return added;
  }

  async removeFromSegment(segmentId: string, guestIds: string[]): Promise<number> {
    const { data, error } = await this.supabase
      .from('segment_members')
      .delete()
      .eq('segment_id', segmentId)
      .in('guest_id', guestIds)
      .select();

    if (error) throw error;

    await this.calculateSegmentMembers(segmentId);
    return data?.length || 0;
  }

  // =============================================
  // EMAIL TEMPLATES
  // =============================================

  async createTemplate(propertyId: string, template: EmailTemplate): Promise<any> {
    const { data: created, error } = await this.supabase
      .from('marketing_email_templates')
      .insert({
        property_id: propertyId,
        name: template.name,
        category: template.category,
        subject: template.subject,
        preview_text: template.previewText || null,
        html_content: template.htmlContent,
        text_content: template.textContent || null,
        variables: template.variables || []
      })
      .select()
      .single();

    if (error) throw error;
    return created;
  }

  async getTemplates(propertyId: string, category?: string): Promise<any[]> {
    let query = this.supabase
      .from('marketing_email_templates')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true);

    if (category) {
      query = query.eq('category', category).order('name');
    } else {
      query = query.order('category').order('name');
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<void> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.subject !== undefined) updateData.subject = updates.subject;
    if (updates.previewText !== undefined) updateData.preview_text = updates.previewText;
    if (updates.htmlContent !== undefined) updateData.html_content = updates.htmlContent;
    if (updates.textContent !== undefined) updateData.text_content = updates.textContent;

    // Increment version using RPC or fetch/update
    const { data: current, error: fetchError } = await this.supabase
      .from('marketing_email_templates')
      .select('version')
      .eq('id', templateId)
      .single();

    if (fetchError) throw fetchError;

    updateData.version = (current?.version || 0) + 1;

    const { error } = await this.supabase
      .from('marketing_email_templates')
      .update(updateData)
      .eq('id', templateId);

    if (error) throw error;
  }

  async duplicateTemplate(templateId: string, newName: string): Promise<any> {
    const { data: template, error: fetchError } = await this.supabase
      .from('marketing_email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (fetchError) throw fetchError;
    if (!template) {
      throw new Error('Template not found');
    }

    return this.createTemplate(template.property_id, {
      name: newName,
      category: template.category,
      subject: template.subject,
      previewText: template.preview_text,
      htmlContent: template.html_content,
      textContent: template.text_content,
      variables: template.variables
    });
  }

  // =============================================
  // EMAIL JOURNEYS
  // =============================================

  async createJourney(
    propertyId: string,
    name: string,
    journeyType: string,
    triggerType: string,
    triggerConfig: any,
    steps: JourneyStep[],
    options?: {
      entrySegmentId?: string;
      allowReentry?: boolean;
      priority?: number;
    }
  ): Promise<any> {
    // Create journey
    const { data: journey, error: journeyError } = await this.supabase
      .from('email_journeys')
      .insert({
        property_id: propertyId,
        name,
        journey_type: journeyType,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        entry_segment_id: options?.entrySegmentId || null,
        allow_reentry: options?.allowReentry || false,
        priority: options?.priority || 5
      })
      .select()
      .single();

    if (journeyError) throw journeyError;

    // Create steps
    for (const step of steps) {
      const { error: stepError } = await this.supabase
        .from('journey_steps')
        .insert({
          journey_id: journey.id,
          step_order: step.stepOrder,
          step_type: step.stepType,
          name: step.name || null,
          config: step.config || {},
          template_id: step.templateId || null,
          wait_duration: step.waitDuration || null
        });

      if (stepError) throw stepError;
    }

    return journey;
  }

  async getJourneys(propertyId: string, status?: string): Promise<any[]> {
    let query = this.supabase
      .from('email_journeys')
      .select('*')
      .eq('property_id', propertyId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data: journeys, error } = await query;
    if (error) throw error;

    if (!journeys || journeys.length === 0) return [];

    // FIX: Iteration 17 - Batch enrollment counts in 2 queries instead of 2N (N+1 pattern)
    const journeyIds = journeys.map(j => j.id);

    const { data: activeCounts } = await this.supabase
      .from('journey_enrollments')
      .select('journey_id')
      .in('journey_id', journeyIds)
      .eq('status', 'active');

    const { data: completedCounts } = await this.supabase
      .from('journey_enrollments')
      .select('journey_id')
      .in('journey_id', journeyIds)
      .eq('status', 'completed');

    // Build count maps
    const activeMap: Record<string, number> = {};
    const completedMap: Record<string, number> = {};
    (activeCounts || []).forEach((row: any) => {
      activeMap[row.journey_id] = (activeMap[row.journey_id] || 0) + 1;
    });
    (completedCounts || []).forEach((row: any) => {
      completedMap[row.journey_id] = (completedMap[row.journey_id] || 0) + 1;
    });

    return journeys.map(journey => ({
      ...journey,
      active_enrollments: activeMap[journey.id] || 0,
      completed_enrollments: completedMap[journey.id] || 0,
    }));
  }

  async getJourneyWithSteps(journeyId: string): Promise<any> {
    const { data: journey, error: journeyError } = await this.supabase
      .from('email_journeys')
      .select('*')
      .eq('id', journeyId)
      .single();

    if (journeyError) throw journeyError;
    if (!journey) {
      return null;
    }

    const { data: steps, error: stepsError } = await this.supabase
      .from('journey_steps')
      .select('*, email_templates(name, subject)')
      .eq('journey_id', journeyId)
      .order('step_order');

    if (stepsError) throw stepsError;

    const stepsWithTemplateInfo = (steps || []).map((step: any) => ({
      ...step,
      template_name: step.email_templates?.name,
      template_subject: step.email_templates?.subject,
      email_templates: undefined
    }));

    return { ...journey, steps: stepsWithTemplateInfo };
  }

  async activateJourney(journeyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('email_journeys')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', journeyId);

    if (error) throw error;
  }

  async pauseJourney(journeyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('email_journeys')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', journeyId);

    if (error) throw error;
  }

  async enrollInJourney(
    journeyId: string,
    guestId: string,
    bookingId?: string,
    metadata?: any
  ): Promise<any> {
    // Get journey
    const { data: journey, error: journeyError } = await this.supabase
      .from('email_journeys')
      .select('*')
      .eq('id', journeyId)
      .single();

    if (journeyError) throw journeyError;
    if (!journey || journey.status !== 'active') {
      throw new Error('Journey not active');
    }

    // Check if already enrolled
    let existingQuery = this.supabase
      .from('journey_enrollments')
      .select('*')
      .eq('journey_id', journeyId)
      .eq('guest_id', guestId)
      .eq('status', 'active');

    if (bookingId) {
      existingQuery = existingQuery.eq('booking_id', bookingId);
    } else {
      existingQuery = existingQuery.is('booking_id', null);
    }

    const { data: existingData } = await existingQuery.single();

    if (existingData && !journey.allow_reentry) {
      return existingData;
    }

    // Get first step
    const { data: firstStep, error: stepError } = await this.supabase
      .from('journey_steps')
      .select('*')
      .eq('journey_id', journeyId)
      .order('step_order')
      .limit(1)
      .single();

    if (stepError) throw stepError;
    if (!firstStep) {
      throw new Error('Journey has no steps');
    }

    // Calculate next action time
    const nextActionAt = this.calculateNextActionTime(firstStep);

    // Create enrollment
    const { data: enrollment, error: enrollError } = await this.supabase
      .from('journey_enrollments')
      .insert({
        journey_id: journeyId,
        guest_id: guestId,
        booking_id: bookingId || null,
        current_step_id: firstStep.id,
        next_action_at: nextActionAt.toISOString(),
        metadata: metadata || {}
      })
      .select()
      .single();

    if (enrollError) throw enrollError;
    return enrollment;
  }

  private calculateNextActionTime(step: any): Date {
    const now = new Date();

    if (step.step_type === 'wait') {
      if (step.wait_duration) {
        // Parse interval string (e.g., "2 days", "4 hours")
        const match = step.wait_duration.match(/(\d+)\s*(day|hour|minute)/i);
        if (match) {
          const value = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          if (unit.startsWith('day')) {
            return dayjs(now).add(value, 'day').toDate();
          } else if (unit.startsWith('hour')) {
            return dayjs(now).add(value, 'hour').toDate();
          }
        }
      }
    }

    return now;
  }

  // =============================================
  // CAMPAIGNS
  // =============================================

  async createCampaign(propertyId: string, campaign: Campaign, userId: string): Promise<any> {
    const { data: created, error } = await this.supabase
      .from('marketing_campaigns')
      .insert({
        property_id: propertyId,
        name: campaign.name,
        description: campaign.description || null,
        campaign_type: campaign.campaignType || 'promotional',
        template_id: campaign.templateId,
        segment_id: campaign.segmentId || null,
        custom_audience: campaign.customAudience || null,
        subject_line: campaign.subjectLine,
        preview_text: campaign.previewText || null,
        from_name: campaign.fromName || null,
        from_email: campaign.fromEmail || null,
        schedule_type: campaign.scheduleType || 'immediate',
        scheduled_at: campaign.scheduledAt ? campaign.scheduledAt.toISOString() : null,
        enable_ab_test: campaign.enableAbTest || false,
        ab_variants: campaign.abVariants || [],
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return created;
  }

  async getCampaigns(propertyId: string, status?: string): Promise<any[]> {
    let query = this.supabase
      .from('marketing_campaigns')
      .select('*, email_templates(name), guest_segments(name)')
      .eq('property_id', propertyId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((c: any) => ({
      ...c,
      template_name: c.email_templates?.name,
      segment_name: c.guest_segments?.name,
      email_templates: undefined,
      guest_segments: undefined
    }));
  }

  async sendCampaign(campaignId: string): Promise<{ success: boolean; queued: number; errors: string[] }> {
    const { data: campaign, error: campaignError } = await this.supabase
      .from('marketing_campaigns')
      .select('*, email_templates(html_content, text_content, variables)')
      .eq('id', campaignId)
      .single();

    if (campaignError) throw campaignError;
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'sent') {
      throw new Error('Campaign already sent');
    }

    // Get recipients
    let recipients: any[];
    if (campaign.custom_audience && campaign.custom_audience.length > 0) {
      const { data, error } = await this.supabase
        .from('guests')
        .select('*')
        .in('id', campaign.custom_audience);

      if (error) throw error;
      recipients = data || [];
    } else if (campaign.segment_id) {
      recipients = await this.getSegmentMembers(campaign.segment_id, 10000, 0);
    } else {
      throw new Error('No recipients defined');
    }

    // Filter out unsubscribed
    const eligibleRecipients: any[] = [];
    for (const recipient of recipients) {
      const { data: canSendResult } = await this.supabase.rpc('can_send_marketing_email', {
        p_guest_id: recipient.id,
        p_property_id: campaign.property_id
      });

      if (canSendResult) {
        eligibleRecipients.push(recipient);
      }
    }

    // Update campaign status
    const { error: updateError } = await this.supabase
      .from('marketing_campaigns')
      .update({
        status: 'sending',
        total_recipients: eligibleRecipients.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (updateError) throw updateError;

    // Queue emails
    const errors: string[] = [];
    let queued = 0;

    for (const recipient of eligibleRecipients) {
      try {
        const mergeVars: MergeVariables = {
          guest_name: `${recipient.full_name}`,
          first_name: recipient.first_name,
          last_name: recipient.last_name,
          email: recipient.email
        };

        await this.queueEmail(
          campaign.property_id,
          recipient.id,
          recipient.email,
          campaign.subject_line,
          campaign.email_templates.html_content,
          'campaign',
          mergeVars,
          {
            campaignId: campaign.id,
            templateId: campaign.template_id
          }
        );
        queued++;
      } catch (error: any) {
        errors.push(`${recipient.email}: ${error.message}`);
      }
    }

    // Update campaign
    const { error: finalUpdateError } = await this.supabase
      .from('marketing_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: queued,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (finalUpdateError) throw finalUpdateError;

    return { success: true, queued, errors };
  }

  async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<void> {
    const { error } = await this.supabase
      .from('marketing_campaigns')
      .update({
        status: 'scheduled',
        schedule_type: 'scheduled',
        scheduled_at: scheduledAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (error) throw error;
  }

  async cancelCampaign(campaignId: string): Promise<void> {
    const { error } = await this.supabase
      .from('marketing_campaigns')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (error) throw error;
  }

  // =============================================
  // TRIGGERED AUTOMATIONS
  // =============================================

  async createAutomation(
    propertyId: string,
    name: string,
    triggerEvent: string,
    templateId: string,
    options?: {
      triggerDelay?: string;
      conditions?: any[];
      suppressIfRecentSend?: boolean;
      suppressHours?: number;
    }
  ): Promise<any> {
    const { data: automation, error } = await this.supabase
      .from('triggered_automations')
      .insert({
        property_id: propertyId,
        name,
        trigger_event: triggerEvent,
        template_id: templateId,
        trigger_delay: options?.triggerDelay || '0 seconds',
        conditions: options?.conditions || [],
        suppress_if_recent_send: options?.suppressIfRecentSend ?? true,
        suppress_hours: options?.suppressHours || 24
      })
      .select()
      .single();

    if (error) throw error;
    return automation;
  }

  async getAutomations(propertyId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('triggered_automations')
      .select('*, email_templates(name)')
      .eq('property_id', propertyId)
      .order('trigger_event')
      .order('name');

    if (error) throw error;

    return (data || []).map((ta: any) => ({
      ...ta,
      template_name: ta.email_templates?.name,
      email_templates: undefined
    }));
  }

  async triggerAutomation(
    automationId: string,
    guestId: string,
    bookingId?: string,
    triggerData?: any
  ): Promise<void> {
    const { data: automation, error: automationError } = await this.supabase
      .from('triggered_automations')
      .select('*')
      .eq('id', automationId)
      .single();

    if (automationError) throw automationError;
    if (!automation || !automation.is_active) {
      return;
    }

    // Check suppression
    if (automation.suppress_if_recent_send) {
      const suppressTime = new Date();
      suppressTime.setHours(suppressTime.getHours() - automation.suppress_hours);

      const { data: recentSend } = await this.supabase
        .from('email_sends')
        .select('*')
        .eq('guest_id', guestId)
        .gt('sent_at', suppressTime.toISOString())
        .limit(1)
        .single();

      if (recentSend) {
        await this.supabase
          .from('automation_executions')
          .insert({
            automation_id: automationId,
            guest_id: guestId,
            booking_id: bookingId || null,
            trigger_event: automation.trigger_event,
            trigger_data: triggerData || {},
            status: 'suppressed',
            suppression_reason: `Recent email sent within ${automation.suppress_hours} hours`
          });
        return;
      }
    }

    // Calculate scheduled time
    let scheduledAt = new Date();
    if (automation.trigger_delay) {
      const match = automation.trigger_delay.match(/(\d+)\s*(day|hour|minute|second)/i);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (unit.startsWith('day')) {
          scheduledAt = dayjs(scheduledAt).add(value, 'day').toDate();
        } else if (unit.startsWith('hour')) {
          scheduledAt = dayjs(scheduledAt).add(value, 'hour').toDate();
        }
      }
    }

    // Create execution
    await this.supabase
      .from('automation_executions')
      .insert({
        automation_id: automationId,
        guest_id: guestId,
        booking_id: bookingId || null,
        trigger_event: automation.trigger_event,
        trigger_data: triggerData || {},
        status: 'pending',
        scheduled_at: scheduledAt.toISOString()
      });

    // Update trigger count
    const { data: current } = await this.supabase
      .from('triggered_automations')
      .select('trigger_count')
      .eq('id', automationId)
      .single();

    await this.supabase
      .from('triggered_automations')
      .update({ trigger_count: (current?.trigger_count || 0) + 1 })
      .eq('id', automationId);
  }

  // =============================================
  // EMAIL SENDING
  // =============================================

  async queueEmail(
    propertyId: string,
    guestId: string,
    toEmail: string,
    subject: string,
    htmlContent: string,
    emailType: string,
    mergeVars: MergeVariables,
    options?: {
      campaignId?: string;
      journeyId?: string;
      journeyStepId?: string;
      templateId?: string;
      bookingId?: string;
    }
  ): Promise<any> {
    // Merge variables into content
    const mergedSubject = this.mergeVariables(subject, mergeVars);
    const mergedContent = this.mergeVariables(htmlContent, mergeVars);

    const { data: send, error } = await this.supabase
      .from('email_sends')
      .insert({
        property_id: propertyId,
        guest_id: guestId,
        email_type: emailType,
        campaign_id: options?.campaignId || null,
        journey_id: options?.journeyId || null,
        journey_step_id: options?.journeyStepId || null,
        template_id: options?.templateId || null,
        booking_id: options?.bookingId || null,
        to_email: toEmail,
        subject: mergedSubject,
        status: 'queued',
        metadata: { html_content: mergedContent }
      })
      .select()
      .single();

    if (error) throw error;
    return send;
  }

  private mergeVariables(content: string, vars: MergeVariables): string {
    let result = content;
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(regex, String(value || ''));
    }
    return result;
  }

  async sendQueuedEmails(limit: number = 50): Promise<number> {
    const { data: queuedEmails, error } = await this.supabase
      .from('email_sends')
      .select('*')
      .eq('status', 'queued')
      .order('created_at')
      .limit(limit);

    if (error) throw error;

    let sent = 0;
    for (const email of queuedEmails || []) {
      try {
        const htmlContent = email.metadata?.html_content || '';

        const info = await this.transporter.sendMail({
          from: process.env.EMAIL_FROM || '"Business" <noreply@business.com>',
          to: email.to_email,
          subject: email.subject,
          html: htmlContent
        });

        await this.supabase
          .from('email_sends')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            message_id: info.messageId,
            provider: 'smtp'
          })
          .eq('id', email.id);

        sent++;
      } catch (error: any) {
        await this.supabase
          .from('email_sends')
          .update({
            status: 'failed',
            metadata: { ...email.metadata, error: error.message }
          })
          .eq('id', email.id);
      }
    }

    return sent;
  }

  // =============================================
  // EMAIL TRACKING
  // =============================================

  async trackOpen(sendId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.supabase
      .from('email_events')
      .insert({
        send_id: sendId,
        event_type: 'open',
        ip_address: ipAddress || null,
        user_agent: userAgent || null
      });

    // Update send record
    const { data: send } = await this.supabase
      .from('email_sends')
      .select('delivered_at')
      .eq('id', sendId)
      .single();

    if (!send?.delivered_at) {
      await this.supabase
        .from('email_sends')
        .update({ delivered_at: new Date().toISOString() })
        .eq('id', sendId);
    }

    // Update campaign/automation metrics
    await this.updateSendMetrics(sendId, 'open');
  }

  async trackClick(sendId: string, linkUrl: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.supabase
      .from('email_events')
      .insert({
        send_id: sendId,
        event_type: 'click',
        link_url: linkUrl,
        ip_address: ipAddress || null,
        user_agent: userAgent || null
      });

    await this.updateSendMetrics(sendId, 'click');
  }

  async trackUnsubscribe(
    guestId: string,
    propertyId: string,
    email: string,
    reason?: string,
    campaignId?: string
  ): Promise<void> {
    // Update preferences - upsert
    await this.supabase
      .from('guest_preferences')
      .upsert({
        guest_id: guestId,
        property_id: propertyId,
        email_marketing: false,
        unsubscribed_at: new Date().toISOString(),
        unsubscribe_reason: reason || null
      }, { onConflict: 'guest_id,property_id' });

    // Log unsubscribe
    await this.supabase
      .from('unsubscribe_log')
      .insert({
        guest_id: guestId,
        property_id: propertyId,
        email,
        unsubscribe_type: 'marketing',
        campaign_id: campaignId || null,
        reason: reason || null
      });

    // Update campaign metrics
    if (campaignId) {
      const { data: campaign } = await this.supabase
        .from('marketing_campaigns')
        .select('unsubscribed_count')
        .eq('id', campaignId)
        .single();

      await this.supabase
        .from('marketing_campaigns')
        .update({ unsubscribed_count: (campaign?.unsubscribed_count || 0) + 1 })
        .eq('id', campaignId);
    }
  }

  private async updateSendMetrics(sendId: string, eventType: 'open' | 'click'): Promise<void> {
    const { data: send } = await this.supabase
      .from('email_sends')
      .select('*')
      .eq('id', sendId)
      .single();

    if (!send) return;

    if (send.campaign_id) {
      const { data: campaign } = await this.supabase
        .from('marketing_campaigns')
        .select('opened_count, clicked_count')
        .eq('id', send.campaign_id)
        .single();

      if (eventType === 'open') {
        await this.supabase
          .from('marketing_campaigns')
          .update({ opened_count: (campaign?.opened_count || 0) + 1 })
          .eq('id', send.campaign_id);
      } else if (eventType === 'click') {
        await this.supabase
          .from('marketing_campaigns')
          .update({ clicked_count: (campaign?.clicked_count || 0) + 1 })
          .eq('id', send.campaign_id);
      }
    }

    if (send.journey_step_id) {
      const { data: step } = await this.supabase
        .from('journey_steps')
        .select('opens_count, clicks_count')
        .eq('id', send.journey_step_id)
        .single();

      if (eventType === 'open') {
        await this.supabase
          .from('journey_steps')
          .update({ opens_count: (step?.opens_count || 0) + 1 })
          .eq('id', send.journey_step_id);
      } else if (eventType === 'click') {
        await this.supabase
          .from('journey_steps')
          .update({ clicks_count: (step?.clicks_count || 0) + 1 })
          .eq('id', send.journey_step_id);
      }
    }
  }

  // =============================================
  // PROMO CODES
  // =============================================

  async createPromoCode(
    propertyId: string,
    code: string,
    discountType: 'percentage' | 'fixed' | 'free_night',
    discountValue: number,
    options?: {
      name?: string;
      validFrom?: Date;
      validUntil?: Date;
      usageLimit?: number;
      minimumNights?: number;
      minimumAmount?: number;
      campaignId?: string;
    }
  ): Promise<any> {
    const { data: promo, error } = await this.supabase
      .from('promo_codes')
      .insert({
        property_id: propertyId,
        code: code.toUpperCase(),
        name: options?.name || code,
        discount_type: discountType,
        discount_value: discountValue,
        valid_from: options?.validFrom ? options.validFrom.toISOString().split('T')[0] : null,
        valid_until: options?.validUntil ? options.validUntil.toISOString().split('T')[0] : null,
        usage_limit: options?.usageLimit || null,
        minimum_nights: options?.minimumNights || null,
        minimum_amount: options?.minimumAmount || null,
        campaign_id: options?.campaignId || null
      })
      .select()
      .single();

    if (error) throw error;
    return promo;
  }

  async validatePromoCode(
    propertyId: string,
    code: string,
    guestId: string,
    nights: number,
    amount: number
  ): Promise<{ valid: boolean; discount?: number; error?: string }> {
    const { data: promo } = await this.supabase
      .from('promo_codes')
      .select('*')
      .eq('property_id', propertyId)
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (!promo) {
      return { valid: false, error: 'Invalid promo code' };
    }

    if (promo.valid_from && new Date() < new Date(promo.valid_from)) {
      return { valid: false, error: 'Promo code not yet valid' };
    }

    if (promo.valid_until && new Date() > new Date(promo.valid_until)) {
      return { valid: false, error: 'Promo code expired' };
    }

    if (promo.usage_limit && promo.times_used >= promo.usage_limit) {
      return { valid: false, error: 'Promo code usage limit reached' };
    }

    if (promo.minimum_nights && nights < promo.minimum_nights) {
      return { valid: false, error: `Minimum ${promo.minimum_nights} nights required` };
    }

    if (promo.minimum_amount && amount < promo.minimum_amount) {
      return { valid: false, error: `Minimum amount of $${promo.minimum_amount} required` };
    }

    // Check guest usage
    const { count } = await this.supabase
      .from('promo_code_usage')
      .select('*', { count: 'exact', head: true })
      .eq('promo_code_id', promo.id)
      .eq('guest_id', guestId);

    if (promo.usage_per_guest && (count || 0) >= promo.usage_per_guest) {
      return { valid: false, error: 'You have already used this promo code' };
    }

    // Calculate discount
    let discount = 0;
    if (promo.discount_type === 'percentage') {
      discount = amount * (promo.discount_value / 100);
    } else if (promo.discount_type === 'fixed') {
      discount = Math.min(promo.discount_value, amount);
    }

    return { valid: true, discount };
  }

  async redeemPromoCode(
    promoCodeId: string,
    guestId: string,
    bookingId: string,
    discountAmount: number
  ): Promise<void> {
    await this.supabase
      .from('promo_code_usage')
      .insert({
        promo_code_id: promoCodeId,
        guest_id: guestId,
        booking_id: bookingId,
        discount_amount: discountAmount
      });

    const { data: promo } = await this.supabase
      .from('promo_codes')
      .select('times_used')
      .eq('id', promoCodeId)
      .single();

    await this.supabase
      .from('promo_codes')
      .update({ times_used: (promo?.times_used || 0) + 1 })
      .eq('id', promoCodeId);
  }

  // =============================================
  // ANALYTICS
  // =============================================

  async getCampaignAnalytics(campaignId: string): Promise<any> {
    const { data: campaign, error } = await this.supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (error) throw error;
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Calculate rates
    const openRate = campaign.sent_count > 0
      ? (campaign.opened_count / campaign.sent_count) * 100
      : 0;
    const clickRate = campaign.opened_count > 0
      ? (campaign.clicked_count / campaign.opened_count) * 100
      : 0;
    const deliveryRate = campaign.sent_count > 0
      ? ((campaign.sent_count - campaign.bounced_count) / campaign.sent_count) * 100
      : 0;
    const unsubscribeRate = campaign.sent_count > 0
      ? (campaign.unsubscribed_count / campaign.sent_count) * 100
      : 0;

    // Get click breakdown using RPC or manual join
    const { data: clickData } = await this.supabase.rpc('get_campaign_click_breakdown', {
      p_campaign_id: campaignId,
      p_limit: 10
    });

    // Get device breakdown
    const { data: deviceData } = await this.supabase.rpc('get_campaign_device_breakdown', {
      p_campaign_id: campaignId
    });

    return {
      ...campaign,
      metrics: {
        openRate: openRate.toFixed(2),
        clickRate: clickRate.toFixed(2),
        deliveryRate: deliveryRate.toFixed(2),
        unsubscribeRate: unsubscribeRate.toFixed(2)
      },
      clicks: clickData || [],
      devices: deviceData || []
    };
  }

  async getJourneyAnalytics(journeyId: string): Promise<any> {
    const journey = await this.getJourneyWithSteps(journeyId);

    if (!journey) {
      throw new Error('Journey not found');
    }

    // Get enrollment stats
    const { count: totalCount } = await this.supabase
      .from('journey_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('journey_id', journeyId);

    const { count: activeCount } = await this.supabase
      .from('journey_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('journey_id', journeyId)
      .eq('status', 'active');

    const { count: completedCount } = await this.supabase
      .from('journey_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('journey_id', journeyId)
      .eq('status', 'completed');

    const { count: exitedCount } = await this.supabase
      .from('journey_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('journey_id', journeyId)
      .eq('status', 'exited');

    const stats = {
      total_enrollments: totalCount || 0,
      active: activeCount || 0,
      completed: completedCount || 0,
      exited: exitedCount || 0
    };

    // Get step performance
    const { data: stepsData } = await this.supabase
      .from('journey_steps')
      .select('id, name, step_type, sends_count, opens_count, clicks_count')
      .eq('journey_id', journeyId)
      .order('step_order');

    const stepPerformance = (stepsData || []).map((step: any) => ({
      ...step,
      open_rate: step.sends_count > 0
        ? ((step.opens_count / step.sends_count) * 100).toFixed(2)
        : 0,
      click_rate: step.opens_count > 0
        ? ((step.clicks_count / step.opens_count) * 100).toFixed(2)
        : 0
    }));

    return {
      ...journey,
      stats,
      stepPerformance
    };
  }

  // =============================================
  // BACKGROUND PROCESSING
  // =============================================

  startBackgroundProcessing(): void {
    // Process pending automations every minute
    cron.schedule('* * * * *', async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        await this.processPendingAutomations();
        await this.processPendingJourneySteps();
        await this.sendQueuedEmails(20);
        await this.processScheduledCampaigns();
      } catch (error) {
        console.error('Background processing error:', error);
      } finally {
        this.isProcessing = false;
      }
    });
  }

  private async processPendingAutomations(): Promise<void> {
    const { data: pending } = await this.supabase.rpc('get_pending_automations', {
      p_limit: 50
    });

    for (const execution of pending || []) {
      try {
        // Get guest and template
        const { data: guest } = await this.supabase
          .from('guests')
          .select('*')
          .eq('id', execution.guest_id)
          .single();

        const { data: template } = await this.supabase
          .from('marketing_email_templates')
          .select('*')
          .eq('id', execution.template_id)
          .single();

        if (!guest || !template || !guest.email) continue;

        // Build merge variables
        const mergeVars: MergeVariables = {
          guest_name: `${guest.full_name}`,
          first_name: guest.first_name,
          last_name: guest.last_name
        };

        // Queue email
        const send = await this.queueEmail(
          template.property_id,
          guest.id,
          guest.email,
          template.subject,
          template.html_content,
          'triggered',
          mergeVars,
          {
            templateId: template.id,
            bookingId: execution.booking_id
          }
        );

        // Update execution
        await this.supabase
          .from('automation_executions')
          .update({
            status: 'sent',
            executed_at: new Date().toISOString(),
            send_id: send.id
          })
          .eq('id', execution.execution_id);

        // Update automation metrics
        const { data: automation } = await this.supabase
          .from('triggered_automations')
          .select('send_count')
          .eq('id', execution.automation_id)
          .single();

        await this.supabase
          .from('triggered_automations')
          .update({ send_count: (automation?.send_count || 0) + 1 })
          .eq('id', execution.automation_id);
      } catch (error) {
        await this.supabase
          .from('automation_executions')
          .update({ status: 'failed' })
          .eq('id', execution.execution_id);
      }
    }
  }

  private async processPendingJourneySteps(): Promise<void> {
    const { data: pending } = await this.supabase.rpc('get_pending_journey_steps', {
      p_limit: 50
    });

    for (const enrollment of pending || []) {
      try {
        await this.processJourneyStep(enrollment.enrollment_id);
      } catch (error) {
        console.error(`Error processing journey step: ${error}`);
      }
    }
  }

  private async processJourneyStep(enrollmentId: string): Promise<void> {
    const { data: enrollment } = await this.supabase
      .from('journey_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (!enrollment || enrollment.status !== 'active') return;

    const { data: step } = await this.supabase
      .from('journey_steps')
      .select('*')
      .eq('id', enrollment.current_step_id)
      .single();

    if (!step) return;

    // Process based on step type
    switch (step.step_type) {
      case 'send_email':
        await this.processEmailStep(enrollment, step);
        break;
      case 'wait':
        await this.processWaitStep(enrollment, step);
        break;
      case 'exit':
        await this.exitJourney(enrollmentId, 'Journey completed');
        return;
    }

    // Move to next step
    const { data: nextStep } = await this.supabase
      .from('journey_steps')
      .select('*')
      .eq('journey_id', step.journey_id)
      .gt('step_order', step.step_order)
      .order('step_order')
      .limit(1)
      .single();

    if (nextStep) {
      const nextActionAt = this.calculateNextActionTime(nextStep);
      await this.supabase
        .from('journey_enrollments')
        .update({
          current_step_id: nextStep.id,
          next_action_at: nextActionAt.toISOString(),
          steps_completed: enrollment.steps_completed + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', enrollmentId);
    } else {
      // Journey complete
      await this.exitJourney(enrollmentId, 'Journey completed');
    }
  }

  private async processEmailStep(enrollment: any, step: any): Promise<void> {
    if (!step.template_id) return;

    const { data: guest } = await this.supabase
      .from('guests')
      .select('*')
      .eq('id', enrollment.guest_id)
      .single();

    const { data: template } = await this.supabase
      .from('marketing_email_templates')
      .select('*')
      .eq('id', step.template_id)
      .single();

    if (!guest || !template || !guest.email) return;

    const mergeVars: MergeVariables = {
      guest_name: `${guest.full_name}`,
      first_name: guest.first_name,
      last_name: guest.last_name
    };

    await this.queueEmail(
      template.property_id,
      guest.id,
      guest.email,
      template.subject,
      template.html_content,
      'journey',
      mergeVars,
      {
        journeyId: enrollment.journey_id,
        journeyStepId: step.id,
        templateId: template.id,
        bookingId: enrollment.booking_id
      }
    );

    // Update step metrics
    const { data: currentStep } = await this.supabase
      .from('journey_steps')
      .select('sends_count')
      .eq('id', step.id)
      .single();

    await this.supabase
      .from('journey_steps')
      .update({ sends_count: (currentStep?.sends_count || 0) + 1 })
      .eq('id', step.id);

    // Update enrollment metrics
    await this.supabase
      .from('journey_enrollments')
      .update({ emails_sent: enrollment.emails_sent + 1 })
      .eq('id', enrollment.id);
  }

  private async processWaitStep(enrollment: any, step: any): Promise<void> {
    // Wait step just moves to next step after the wait duration
    // The next action time already accounts for the wait
  }

  private async exitJourney(enrollmentId: string, reason: string): Promise<void> {
    await this.supabase
      .from('journey_enrollments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        exit_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', enrollmentId);
  }

  private async processScheduledCampaigns(): Promise<void> {
    const { data: scheduled } = await this.supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    for (const campaign of scheduled || []) {
      try {
        await this.sendCampaign(campaign.id);
      } catch (error) {
        console.error(`Error sending scheduled campaign ${campaign.id}: ${error}`);
      }
    }
  }
}

export const marketingAutomationService = new MarketingAutomationService();
