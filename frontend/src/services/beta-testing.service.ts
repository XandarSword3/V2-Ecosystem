// Beta Testing Framework for V2 Resort
// Sprint 15: UAT & Polish

import { createClient } from '@supabase/supabase-js';

interface BetaTester {
  id: string;
  email: string;
  name: string;
  role: 'internal' | 'external' | 'vip';
  status: 'invited' | 'active' | 'completed' | 'dropped';
  invited_at: Date;
  activated_at?: Date;
  completed_at?: Date;
  total_sessions: number;
  total_feedback: number;
  nps_score?: number;
}

interface FeedbackItem {
  id: string;
  tester_id: string;
  type: 'bug' | 'feature' | 'usability' | 'performance' | 'general';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  screenshot_urls?: string[];
  device_info: DeviceInfo;
  page_url: string;
  status: 'new' | 'triaged' | 'in_progress' | 'resolved' | 'wont_fix';
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
  resolution_notes?: string;
}

interface DeviceInfo {
  user_agent: string;
  platform: string;
  browser: string;
  browser_version: string;
  screen_width: number;
  screen_height: number;
  device_pixel_ratio: number;
  language: string;
  timezone: string;
}

interface BetaSession {
  id: string;
  tester_id: string;
  started_at: Date;
  ended_at?: Date;
  duration_seconds?: number;
  pages_visited: string[];
  actions_performed: SessionAction[];
  errors_encountered: ErrorEvent[];
  device_info: DeviceInfo;
}

interface SessionAction {
  timestamp: Date;
  action: string;
  element?: string;
  page: string;
  metadata?: Record<string, unknown>;
}

interface ErrorEvent {
  timestamp: Date;
  error_type: string;
  message: string;
  stack?: string;
  page: string;
}

interface NPSSurvey {
  id: string;
  tester_id: string;
  score: number;
  feedback?: string;
  would_recommend: boolean;
  favorite_feature?: string;
  biggest_pain_point?: string;
  suggestions?: string;
  submitted_at: Date;
}

interface BetaMetrics {
  total_testers: number;
  active_testers: number;
  total_sessions: number;
  total_feedback: number;
  bugs_reported: number;
  bugs_resolved: number;
  average_session_duration: number;
  average_nps: number;
  feature_adoption: Record<string, number>;
  error_rate: number;
}

class BetaTestingService {
  private supabase;
  private readonly BETA_COOKIE = 'v2_beta_tester';

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  // ==================== Tester Management ====================

  async inviteBetaTester(
    email: string,
    name: string,
    role: BetaTester['role'] = 'external'
  ): Promise<{ success: boolean; tester?: BetaTester; inviteLink?: string }> {
    try {
      // Check if already invited
      const { data: existing } = await this.supabase
        .from('beta_testers')
        .select('*')
        .eq('email', email)
        .single();

      if (existing) {
        return { success: false };
      }

      // Create beta tester record
      const { data: tester, error } = await this.supabase
        .from('beta_testers')
        .insert({
          email,
          name,
          role,
          status: 'invited',
          invited_at: new Date().toISOString(),
          total_sessions: 0,
          total_feedback: 0
        })
        .select()
        .single();

      if (error) throw error;

      // Generate invite link
      const inviteToken = await this.generateInviteToken(tester.id);
      const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/beta/activate?token=${inviteToken}`;

      // Send invite email
      await this.sendBetaInviteEmail(email, name, inviteLink);

      return { success: true, tester, inviteLink };
    } catch (error) {
      console.error('Error inviting beta tester:', error);
      return { success: false };
    }
  }

  private async generateInviteToken(testerId: string): Promise<string> {
    const token = crypto.randomUUID();
    
    await this.supabase
      .from('beta_invite_tokens')
      .insert({
        token,
        tester_id: testerId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });

    return token;
  }

  async activateBetaTester(token: string): Promise<{ success: boolean; testerId?: string }> {
    try {
      const { data: tokenData } = await this.supabase
        .from('beta_invite_tokens')
        .select('*, beta_testers(*)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!tokenData) {
        return { success: false };
      }

      // Activate tester
      await this.supabase
        .from('beta_testers')
        .update({
          status: 'active',
          activated_at: new Date().toISOString()
        })
        .eq('id', tokenData.tester_id);

      // Invalidate token
      await this.supabase
        .from('beta_invite_tokens')
        .delete()
        .eq('token', token);

      return { success: true, testerId: tokenData.tester_id };
    } catch (error) {
      console.error('Error activating beta tester:', error);
      return { success: false };
    }
  }

  async getBetaTesters(filters?: {
    status?: BetaTester['status'];
    role?: BetaTester['role'];
  }): Promise<BetaTester[]> {
    let query = this.supabase
      .from('beta_testers')
      .select('*')
      .order('invited_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.role) {
      query = query.eq('role', filters.role);
    }

    const { data } = await query;
    return data || [];
  }

  // ==================== Session Tracking ====================

  async startSession(testerId: string, deviceInfo: DeviceInfo): Promise<string> {
    const { data: session } = await this.supabase
      .from('beta_sessions')
      .insert({
        tester_id: testerId,
        started_at: new Date().toISOString(),
        device_info: deviceInfo,
        pages_visited: [],
        actions_performed: [],
        errors_encountered: []
      })
      .select()
      .single();

    // Increment session count
    await this.supabase.rpc('increment_tester_sessions', {
      p_tester_id: testerId
    });

    return session?.id;
  }

  async endSession(sessionId: string): Promise<void> {
    const { data: session } = await this.supabase
      .from('beta_sessions')
      .select('started_at')
      .eq('id', sessionId)
      .single();

    if (session) {
      const duration = Math.floor(
        (Date.now() - new Date(session.started_at).getTime()) / 1000
      );

      await this.supabase
        .from('beta_sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: duration
        })
        .eq('id', sessionId);
    }
  }

  async trackPageVisit(sessionId: string, pageUrl: string): Promise<void> {
    await this.supabase.rpc('append_page_visit', {
      p_session_id: sessionId,
      p_page_url: pageUrl
    });
  }

  async trackAction(
    sessionId: string,
    action: string,
    element?: string,
    page?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const actionData: SessionAction = {
      timestamp: new Date(),
      action,
      element,
      page: page || window.location.pathname,
      metadata
    };

    await this.supabase.rpc('append_session_action', {
      p_session_id: sessionId,
      p_action: actionData
    });
  }

  async trackError(
    sessionId: string,
    errorType: string,
    message: string,
    stack?: string
  ): Promise<void> {
    const errorEvent: ErrorEvent = {
      timestamp: new Date(),
      error_type: errorType,
      message,
      stack,
      page: typeof window !== 'undefined' ? window.location.pathname : ''
    };

    await this.supabase.rpc('append_session_error', {
      p_session_id: sessionId,
      p_error: errorEvent
    });
  }

  // ==================== Feedback Collection ====================

  async submitFeedback(
    testerId: string,
    feedback: Omit<FeedbackItem, 'id' | 'tester_id' | 'status' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; feedbackId?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('beta_feedback')
        .insert({
          tester_id: testerId,
          ...feedback,
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Increment feedback count
      await this.supabase.rpc('increment_tester_feedback', {
        p_tester_id: testerId
      });

      // Notify team for critical issues
      if (feedback.severity === 'critical') {
        await this.notifyCriticalFeedback(data);
      }

      return { success: true, feedbackId: data.id };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return { success: false };
    }
  }

  async getFeedback(filters?: {
    type?: FeedbackItem['type'];
    severity?: FeedbackItem['severity'];
    status?: FeedbackItem['status'];
    testerId?: string;
  }): Promise<FeedbackItem[]> {
    let query = this.supabase
      .from('beta_feedback')
      .select('*, beta_testers(name, email)')
      .order('created_at', { ascending: false });

    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.testerId) query = query.eq('tester_id', filters.testerId);

    const { data } = await query;
    return data || [];
  }

  async updateFeedbackStatus(
    feedbackId: string,
    status: FeedbackItem['status'],
    resolutionNotes?: string
  ): Promise<void> {
    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'resolved') {
      update.resolved_at = new Date().toISOString();
      update.resolution_notes = resolutionNotes;
    }

    await this.supabase
      .from('beta_feedback')
      .update(update)
      .eq('id', feedbackId);
  }

  // ==================== NPS Surveys ====================

  async submitNPSSurvey(
    testerId: string,
    survey: Omit<NPSSurvey, 'id' | 'tester_id' | 'submitted_at'>
  ): Promise<boolean> {
    try {
      await this.supabase
        .from('beta_nps_surveys')
        .insert({
          tester_id: testerId,
          ...survey,
          submitted_at: new Date().toISOString()
        });

      // Update tester NPS score
      await this.supabase
        .from('beta_testers')
        .update({ nps_score: survey.score })
        .eq('id', testerId);

      return true;
    } catch (error) {
      console.error('Error submitting NPS survey:', error);
      return false;
    }
  }

  // ==================== Metrics & Analytics ====================

  async getBetaMetrics(): Promise<BetaMetrics> {
    const [
      testersResult,
      sessionsResult,
      feedbackResult,
      npsResult
    ] = await Promise.all([
      this.supabase.from('beta_testers').select('status', { count: 'exact' }),
      this.supabase.from('beta_sessions').select('duration_seconds'),
      this.supabase.from('beta_feedback').select('type, severity, status'),
      this.supabase.from('beta_nps_surveys').select('score')
    ]);

    const testers = testersResult.data || [];
    const sessions = sessionsResult.data || [];
    const feedback = feedbackResult.data || [];
    const nps = npsResult.data || [];

    // Calculate metrics
    const activeTesters = testers.filter(t => t.status === 'active').length;
    const bugs = feedback.filter(f => f.type === 'bug');
    const resolvedBugs = bugs.filter(b => b.status === 'resolved');
    const avgDuration = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessions.length
      : 0;
    const avgNps = nps.length > 0
      ? nps.reduce((sum, n) => sum + n.score, 0) / nps.length
      : 0;

    return {
      total_testers: testers.length,
      active_testers: activeTesters,
      total_sessions: sessions.length,
      total_feedback: feedback.length,
      bugs_reported: bugs.length,
      bugs_resolved: resolvedBugs.length,
      average_session_duration: avgDuration,
      average_nps: avgNps,
      feature_adoption: await this.getFeatureAdoption(),
      error_rate: await this.getErrorRate()
    };
  }

  private async getFeatureAdoption(): Promise<Record<string, number>> {
    // Track which features beta testers are using
    const { data: sessions } = await this.supabase
      .from('beta_sessions')
      .select('actions_performed');

    const featureCounts: Record<string, number> = {};
    const features = ['booking', 'menu', 'cart', 'order', 'pool', 'profile'];

    for (const session of sessions || []) {
      const actions = session.actions_performed || [];
      for (const action of actions) {
        for (const feature of features) {
          if (action.page?.includes(feature)) {
            featureCounts[feature] = (featureCounts[feature] || 0) + 1;
          }
        }
      }
    }

    return featureCounts;
  }

  private async getErrorRate(): Promise<number> {
    const { data: sessions } = await this.supabase
      .from('beta_sessions')
      .select('errors_encountered');

    let totalErrors = 0;
    let totalSessions = sessions?.length || 0;

    for (const session of sessions || []) {
      totalErrors += (session.errors_encountered || []).length;
    }

    return totalSessions > 0 ? totalErrors / totalSessions : 0;
  }

  // ==================== Communication ====================

  private async sendBetaInviteEmail(
    email: string,
    name: string,
    inviteLink: string
  ): Promise<void> {
    // Integration with email service
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    await sgMail.send({
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      templateId: process.env.SENDGRID_BETA_INVITE_TEMPLATE,
      dynamicTemplateData: {
        name,
        inviteLink,
        appName: 'V2 Resort'
      }
    });
  }

  private async notifyCriticalFeedback(feedback: FeedbackItem): Promise<void> {
    // Slack notification for critical bugs
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Critical Beta Feedback Received`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${feedback.title}*\n${feedback.description}`
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Category: ${feedback.category} | Page: ${feedback.page_url}`
                }
              ]
            }
          ]
        })
      });
    }
  }

  async sendBetaNewsletter(
    subject: string,
    content: string,
    testers?: string[]
  ): Promise<void> {
    const query = testers
      ? this.supabase
          .from('beta_testers')
          .select('email, name')
          .in('id', testers)
          .eq('status', 'active')
      : this.supabase
          .from('beta_testers')
          .select('email, name')
          .eq('status', 'active');

    const { data: recipients } = await query;

    for (const recipient of recipients || []) {
      // Send personalized email
      const sgMail = require('@sendgrid/mail');
      await sgMail.send({
        to: recipient.email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject,
        html: content.replace('{{name}}', recipient.name)
      });
    }
  }
}

// ==================== React Hooks & Components ====================

/**
 * Beta Feedback Widget Component
 * Floating button that allows beta testers to submit feedback
 */
export function BetaFeedbackWidget() {
  // This would be a React component
  return `
    <div class="beta-feedback-widget">
      <button class="beta-feedback-trigger" aria-label="Submit Feedback">
        <span>💬</span> Feedback
      </button>
      <div class="beta-feedback-modal" role="dialog" aria-modal="true">
        <h2>Submit Beta Feedback</h2>
        <form>
          <select name="type" required>
            <option value="">Select Type</option>
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="usability">Usability Issue</option>
            <option value="performance">Performance Issue</option>
            <option value="general">General Feedback</option>
          </select>
          <select name="severity" required>
            <option value="">Select Severity</option>
            <option value="critical">Critical - App Broken</option>
            <option value="high">High - Major Issue</option>
            <option value="medium">Medium - Annoying but Works</option>
            <option value="low">Low - Minor Issue</option>
          </select>
          <input type="text" name="title" placeholder="Brief title" required />
          <textarea name="description" placeholder="Describe the issue..." required></textarea>
          <button type="button">📷 Add Screenshot</button>
          <button type="submit">Submit Feedback</button>
        </form>
      </div>
    </div>
  `;
}

/**
 * Collect device information for session tracking
 */
export function collectDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      user_agent: '',
      platform: '',
      browser: '',
      browser_version: '',
      screen_width: 0,
      screen_height: 0,
      device_pixel_ratio: 1,
      language: 'en',
      timezone: 'UTC'
    };
  }

  const ua = window.navigator.userAgent;
  let browser = 'Unknown';
  let browserVersion = '';

  if (ua.includes('Firefox')) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || '';
  } else if (ua.includes('Chrome')) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || '';
  } else if (ua.includes('Safari')) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/(\d+)/)?.[1] || '';
  } else if (ua.includes('Edge')) {
    browser = 'Edge';
    browserVersion = ua.match(/Edge\/(\d+)/)?.[1] || '';
  }

  return {
    user_agent: ua,
    platform: window.navigator.platform,
    browser,
    browser_version: browserVersion,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    device_pixel_ratio: window.devicePixelRatio,
    language: window.navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

export const betaTestingService = new BetaTestingService();
