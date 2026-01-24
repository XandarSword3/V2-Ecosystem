/**
 * V2 Resort - Email Analytics Service
 * Tracks email metrics and provides insights
 */

import { supabase } from '../lib/supabase';

export interface EmailMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
  unsubscribeRate: number;
}

export interface EmailEvent {
  id?: string;
  message_id: string;
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'dropped';
  timestamp: string;
  email?: string;
  user_id?: string;
  template_id?: string;
  campaign_id?: string;
  link_url?: string;
  user_agent?: string;
  ip_address?: string;
  metadata?: Record<string, any>;
}

export interface CampaignMetrics extends EmailMetrics {
  campaign_id: string;
  campaign_name: string;
  subject_line: string;
  sent_at: string;
  unique_opens: number;
  unique_clicks: number;
  total_revenue?: number;
  conversions?: number;
}

export interface TemplatePerformance {
  template_id: string;
  template_name: string;
  total_sent: number;
  metrics: EmailMetrics;
  average_open_time?: number; // seconds after delivery
  top_clicked_links: Array<{ url: string; clicks: number }>;
}

class EmailAnalyticsService {
  /**
   * Record an email event
   */
  async recordEvent(event: Omit<EmailEvent, 'id'>): Promise<void> {
    const { error } = await supabase.from('email_events').insert({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    });

    if (error) {
      console.error('[EmailAnalytics] Failed to record event:', error);
    }

    // Update email record with latest status
    if (['delivered', 'opened', 'clicked', 'bounced', 'complained'].includes(event.event_type)) {
      await supabase
        .from('emails')
        .update({
          [`${event.event_type}_at`]: event.timestamp || new Date().toISOString(),
          status: event.event_type,
        })
        .eq('message_id', event.message_id);
    }
  }

  /**
   * Process SendGrid webhook events
   */
  async processSendGridWebhook(events: any[]): Promise<void> {
    for (const event of events) {
      const mappedEvent: Omit<EmailEvent, 'id'> = {
        message_id: event.sg_message_id?.split('.')[0] || event['smtp-id'],
        event_type: this.mapSendGridEventType(event.event),
        timestamp: new Date(event.timestamp * 1000).toISOString(),
        email: event.email,
        metadata: {
          sg_event_id: event.sg_event_id,
          category: event.category,
          response: event.response,
          reason: event.reason,
        },
      };

      if (event.url) {
        mappedEvent.link_url = event.url;
      }

      if (event.useragent) {
        mappedEvent.user_agent = event.useragent;
      }

      if (event.ip) {
        mappedEvent.ip_address = event.ip;
      }

      await this.recordEvent(mappedEvent);
    }
  }

  /**
   * Map SendGrid event types to our types
   */
  private mapSendGridEventType(sgEvent: string): EmailEvent['event_type'] {
    const mapping: Record<string, EmailEvent['event_type']> = {
      processed: 'sent',
      delivered: 'delivered',
      open: 'opened',
      click: 'clicked',
      bounce: 'bounced',
      spamreport: 'complained',
      unsubscribe: 'unsubscribed',
      dropped: 'dropped',
      deferred: 'sent', // Treat deferred as still in-flight
    };

    return mapping[sgEvent] || 'sent';
  }

  /**
   * Get overall email metrics for a period
   */
  async getMetrics(
    period: 'day' | 'week' | 'month' | 'year',
    startDate?: string
  ): Promise<EmailMetrics> {
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };

    const fromDate = startDate || new Date(Date.now() - periodMs[period]).toISOString();

    const { data: events, error } = await supabase
      .from('email_events')
      .select('event_type')
      .gte('timestamp', fromDate);

    if (error) {
      throw error;
    }

    return this.calculateMetrics(events || []);
  }

  /**
   * Calculate metrics from events
   */
  private calculateMetrics(events: Array<{ event_type: string }>): EmailMetrics {
    const counts = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
    };

    for (const event of events) {
      if (event.event_type in counts) {
        counts[event.event_type as keyof typeof counts]++;
      }
    }

    const sent = counts.sent + counts.delivered; // sent includes delivered
    const delivered = counts.delivered;

    return {
      ...counts,
      sent,
      deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
      openRate: delivered > 0 ? (counts.opened / delivered) * 100 : 0,
      clickRate: counts.opened > 0 ? (counts.clicked / counts.opened) * 100 : 0,
      bounceRate: sent > 0 ? (counts.bounced / sent) * 100 : 0,
      complaintRate: delivered > 0 ? (counts.complained / delivered) * 100 : 0,
      unsubscribeRate: delivered > 0 ? (counts.unsubscribed / delivered) * 100 : 0,
    };
  }

  /**
   * Get metrics by template
   */
  async getTemplatePerformance(
    templateId?: string,
    period: 'week' | 'month' = 'month'
  ): Promise<TemplatePerformance[]> {
    const periodMs = {
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    const fromDate = new Date(Date.now() - periodMs[period]).toISOString();

    let query = supabase
      .from('email_events')
      .select('template_id, event_type, link_url')
      .gte('timestamp', fromDate);

    if (templateId) {
      query = query.eq('template_id', templateId);
    }

    const { data: events, error } = await query;

    if (error) {
      throw error;
    }

    // Group by template
    const templateMap = new Map<string, Array<{ event_type: string; link_url?: string }>>();

    for (const event of events || []) {
      if (!event.template_id) continue;

      if (!templateMap.has(event.template_id)) {
        templateMap.set(event.template_id, []);
      }
      templateMap.get(event.template_id)!.push(event);
    }

    // Calculate metrics per template
    const results: TemplatePerformance[] = [];

    for (const [tid, templateEvents] of templateMap) {
      const metrics = this.calculateMetrics(templateEvents);
      
      // Count link clicks
      const linkClicks = new Map<string, number>();
      for (const event of templateEvents) {
        if (event.event_type === 'clicked' && event.link_url) {
          linkClicks.set(event.link_url, (linkClicks.get(event.link_url) || 0) + 1);
        }
      }

      const topClickedLinks = Array.from(linkClicks.entries())
        .map(([url, clicks]) => ({ url, clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5);

      results.push({
        template_id: tid,
        template_name: tid, // Would need to join with templates table
        total_sent: metrics.sent,
        metrics,
        top_clicked_links: topClickedLinks,
      });
    }

    return results.sort((a, b) => b.total_sent - a.total_sent);
  }

  /**
   * Get campaign metrics
   */
  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics | null> {
    const { data: events, error } = await supabase
      .from('email_events')
      .select('event_type, email')
      .eq('campaign_id', campaignId);

    if (error || !events) {
      return null;
    }

    const metrics = this.calculateMetrics(events);

    // Count unique opens and clicks
    const openedEmails = new Set<string>();
    const clickedEmails = new Set<string>();

    for (const event of events) {
      if (event.event_type === 'opened' && event.email) {
        openedEmails.add(event.email);
      }
      if (event.event_type === 'clicked' && event.email) {
        clickedEmails.add(event.email);
      }
    }

    // Get campaign details
    const { data: campaign } = await supabase
      .from('email_campaigns')
      .select('name, subject, sent_at')
      .eq('id', campaignId)
      .single();

    return {
      campaign_id: campaignId,
      campaign_name: campaign?.name || campaignId,
      subject_line: campaign?.subject || '',
      sent_at: campaign?.sent_at || '',
      ...metrics,
      unique_opens: openedEmails.size,
      unique_clicks: clickedEmails.size,
    };
  }

  /**
   * Get time-series metrics for charts
   */
  async getTimeSeriesMetrics(
    period: 'day' | 'week' | 'month',
    granularity: 'hour' | 'day' | 'week'
  ): Promise<Array<{
    timestamp: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
  }>> {
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    const fromDate = new Date(Date.now() - periodMs[period]).toISOString();

    const { data: events, error } = await supabase
      .from('email_events')
      .select('event_type, timestamp')
      .gte('timestamp', fromDate)
      .order('timestamp');

    if (error) {
      throw error;
    }

    // Group by time bucket
    const granularityMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    };

    const bucketSize = granularityMs[granularity];
    const buckets = new Map<number, {
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      bounced: number;
    }>();

    for (const event of events || []) {
      const eventTime = new Date(event.timestamp).getTime();
      const bucketTime = Math.floor(eventTime / bucketSize) * bucketSize;

      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
        });
      }

      const bucket = buckets.get(bucketTime)!;
      const type = event.event_type as keyof typeof bucket;
      if (type in bucket) {
        bucket[type]++;
      }
    }

    return Array.from(buckets.entries())
      .map(([timestamp, data]) => ({
        timestamp: new Date(timestamp).toISOString(),
        ...data,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get deliverability insights
   */
  async getDeliverabilityInsights(): Promise<{
    overall_health: 'good' | 'warning' | 'critical';
    bounce_rate: number;
    complaint_rate: number;
    recommendations: string[];
    domain_stats: Array<{
      domain: string;
      sent: number;
      delivered: number;
      bounced: number;
      deliveryRate: number;
    }>;
  }> {
    const metrics = await this.getMetrics('week');

    // Determine health status
    let health: 'good' | 'warning' | 'critical' = 'good';
    const recommendations: string[] = [];

    if (metrics.bounceRate > 5 || metrics.complaintRate > 0.1) {
      health = 'critical';
      if (metrics.bounceRate > 5) {
        recommendations.push('Your bounce rate is critically high. Clean your email list immediately.');
      }
      if (metrics.complaintRate > 0.1) {
        recommendations.push('Your complaint rate is critically high. Review your email content and targeting.');
      }
    } else if (metrics.bounceRate > 2 || metrics.complaintRate > 0.05) {
      health = 'warning';
      if (metrics.bounceRate > 2) {
        recommendations.push('Your bounce rate is above industry standards. Consider validating email addresses.');
      }
      if (metrics.complaintRate > 0.05) {
        recommendations.push('Your complaint rate is elevated. Review unsubscribe options and email frequency.');
      }
    }

    if (metrics.openRate < 15) {
      recommendations.push('Your open rate is below average. Test different subject lines and send times.');
    }

    if (metrics.unsubscribeRate > 1) {
      recommendations.push('Your unsubscribe rate is high. Review your email frequency and content relevance.');
    }

    // Get domain-level stats
    const { data: domainEvents } = await supabase
      .from('email_events')
      .select('email, event_type')
      .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const domainMap = new Map<string, {
      sent: number;
      delivered: number;
      bounced: number;
    }>();

    for (const event of domainEvents || []) {
      if (!event.email) continue;

      const domain = event.email.split('@')[1]?.toLowerCase();
      if (!domain) continue;

      if (!domainMap.has(domain)) {
        domainMap.set(domain, { sent: 0, delivered: 0, bounced: 0 });
      }

      const stats = domainMap.get(domain)!;
      if (event.event_type === 'sent' || event.event_type === 'delivered') {
        stats.sent++;
      }
      if (event.event_type === 'delivered') {
        stats.delivered++;
      }
      if (event.event_type === 'bounced') {
        stats.bounced++;
      }
    }

    const domain_stats = Array.from(domainMap.entries())
      .map(([domain, stats]) => ({
        domain,
        ...stats,
        deliveryRate: stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0,
      }))
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 10);

    return {
      overall_health: health,
      bounce_rate: metrics.bounceRate,
      complaint_rate: metrics.complaintRate,
      recommendations,
      domain_stats,
    };
  }

  /**
   * Generate pixel tracking URL
   */
  generateTrackingPixel(messageId: string): string {
    const baseUrl = process.env.BACKEND_URL || 'https://api.v2resort.com';
    return `${baseUrl}/email/track/open/${messageId}`;
  }

  /**
   * Generate click tracking URL
   */
  generateClickTrackingUrl(messageId: string, originalUrl: string): string {
    const baseUrl = process.env.BACKEND_URL || 'https://api.v2resort.com';
    const encoded = encodeURIComponent(originalUrl);
    return `${baseUrl}/email/track/click/${messageId}?url=${encoded}`;
  }
}

export const emailAnalyticsService = new EmailAnalyticsService();
