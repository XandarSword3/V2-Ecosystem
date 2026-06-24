import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

type DatabaseTables = {
  beta_testers: Row[];
  beta_invite_tokens: Row[];
  beta_sessions: Row[];
  beta_feedback: Row[];
  beta_nps_surveys: Row[];
};

type Filter =
  | { kind: 'eq'; column: string; value: unknown }
  | { kind: 'gt'; column: string; value: unknown }
  | { kind: 'in'; column: string; value: unknown[] };

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

function cloneRow<T extends Row>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter((row) => {
    return filters.every((filter) => {
      const value = row[filter.column];
      if (filter.kind === 'eq') return value === filter.value;
      if (filter.kind === 'in') return filter.value.includes(value);
      const left = new Date(String(value)).getTime();
      const right = new Date(String(filter.value)).getTime();
      return left > right;
    });
  });
}

function createSupabaseMock(tables: DatabaseTables) {
  const rpc = vi.fn(async (fnName: string, payload: Record<string, unknown>) => {
    if (fnName === 'increment_tester_sessions') {
      const tester = tables.beta_testers.find((t) => t.id === payload.p_tester_id);
      if (tester) {
        tester.total_sessions = Number(tester.total_sessions || 0) + 1;
      }
    }

    if (fnName === 'increment_tester_feedback') {
      const tester = tables.beta_testers.find((t) => t.id === payload.p_tester_id);
      if (tester) {
        tester.total_feedback = Number(tester.total_feedback || 0) + 1;
      }
    }

    if (fnName === 'append_page_visit') {
      const session = tables.beta_sessions.find((s) => s.id === payload.p_session_id);
      if (session) {
        const pages = (session.pages_visited as unknown[] | undefined) || [];
        session.pages_visited = [...pages, payload.p_page_url];
      }
    }

    if (fnName === 'append_session_action') {
      const session = tables.beta_sessions.find((s) => s.id === payload.p_session_id);
      if (session) {
        const actions = (session.actions_performed as unknown[] | undefined) || [];
        session.actions_performed = [...actions, payload.p_action];
      }
    }

    if (fnName === 'append_session_error') {
      const session = tables.beta_sessions.find((s) => s.id === payload.p_session_id);
      if (session) {
        const errors = (session.errors_encountered as unknown[] | undefined) || [];
        session.errors_encountered = [...errors, payload.p_error];
      }
    }

    return { data: null, error: null };
  });

  function tableQuery(tableName: keyof DatabaseTables) {
    const filters: Filter[] = [];
    let orderBy: { column: string; ascending: boolean } | null = null;
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row[] | Row | null = null;

    const execute = async (single: boolean) => {
      const table = tables[tableName];

      if (mode === 'insert') {
        const rowsToInsert = Array.isArray(payload) ? payload : [payload as Row];
        const inserted = rowsToInsert.map((row, index) => {
          const id = row.id || `${String(tableName)}-${table.length + index + 1}`;
          const withId = { ...row, id };
          table.push(cloneRow(withId));
          return withId;
        });
        const data = single ? inserted[0] : inserted;
        return { data, error: null };
      }

      if (mode === 'update') {
        const target = applyFilters(table, filters);
        for (const row of target) {
          Object.assign(row, payload as Row);
        }
        return { data: single ? target[0] : target, error: null };
      }

      if (mode === 'delete') {
        const keep = table.filter((row) => !applyFilters([row], filters).length);
        tables[tableName] = keep;
        return { data: null, error: null };
      }

      let selected = applyFilters(table, filters).map((row) => cloneRow(row));
      if (orderBy) {
        const sortColumn = orderBy.column;
        const ascending = orderBy.ascending;
        selected = selected.sort((a, b) => {
          const left = String(a[sortColumn] ?? '');
          const right = String(b[sortColumn] ?? '');
          return ascending ? left.localeCompare(right) : right.localeCompare(left);
        });
      }

      return { data: single ? selected[0] || null : selected, error: null };
    };

    const query = {
      select: (...args: unknown[]) => {
        void args;
        if (mode !== 'insert' && mode !== 'update' && mode !== 'delete') {
          mode = 'select';
        }
        return query;
      },
      insert: (rows: Row | Row[]) => {
        mode = 'insert';
        payload = rows;
        return query;
      },
      update: (row: Row) => {
        mode = 'update';
        payload = row;
        return query;
      },
      delete: () => {
        mode = 'delete';
        return query;
      },
      eq: (column: string, value: unknown) => {
        filters.push({ kind: 'eq', column, value });
        return query;
      },
      gt: (column: string, value: unknown) => {
        filters.push({ kind: 'gt', column, value });
        return query;
      },
      in: (column: string, value: unknown[]) => {
        filters.push({ kind: 'in', column, value });
        return query;
      },
      order: (column: string, config?: { ascending?: boolean }) => {
        orderBy = { column, ascending: config?.ascending !== false };
        return query;
      },
      single: async () => execute(true),
      then: (
        onFulfilled?: (value: { data: unknown; error: null }) => unknown,
        onRejected?: (reason?: unknown) => unknown
      ) => execute(false).then(onFulfilled, onRejected),
    };

    return query;
  }

  return {
    from: (tableName: keyof DatabaseTables) => tableQuery(tableName),
    rpc,
  };
}

async function loadModule(tables: DatabaseTables) {
  vi.resetModules();
  createClientMock.mockImplementation(() => createSupabaseMock(tables));
  return import('../../src/services/beta-testing.service');
}

describe('beta testing service', () => {
  let tables: DatabaseTables;

  beforeEach(() => {
    tables = {
      beta_testers: [],
      beta_invite_tokens: [],
      beta_sessions: [],
      beta_feedback: [],
      beta_nps_surveys: [],
    };

    createClientMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://resort.test');
  });

  it('invites and activates beta testers', async () => {
    const mod = await loadModule(tables);
    const service = mod.betaTestingService as unknown as {
      inviteBetaTester: (email: string, name: string, role?: 'internal' | 'external' | 'vip') => Promise<{ success: boolean; inviteLink?: string }>;
      activateBetaTester: (token: string) => Promise<{ success: boolean; testerId?: string }>;
      sendBetaInviteEmail: (email: string, name: string, inviteLink: string) => Promise<void>;
    };

    vi.spyOn(service, 'sendBetaInviteEmail').mockResolvedValue();

    const invited = await service.inviteBetaTester('beta@v2-hub.test', 'Beta User', 'vip');
    expect(invited.success).toBe(true);
    expect(invited.inviteLink).toContain('/beta/activate?token=');
    expect(tables.beta_testers.length).toBe(1);
    expect(tables.beta_invite_tokens.length).toBe(1);

    const duplicate = await service.inviteBetaTester('beta@v2-hub.test', 'Beta User');
    expect(duplicate.success).toBe(false);

    const token = String(tables.beta_invite_tokens[0].token);
    const activated = await service.activateBetaTester(token);
    expect(activated.success).toBe(true);
    expect(activated.testerId).toBe(String(tables.beta_testers[0].id));
    expect(tables.beta_testers[0].status).toBe('active');
    expect(tables.beta_invite_tokens.length).toBe(0);
  });

  it('tracks sessions, feedback, and nps submissions', async () => {
    const mod = await loadModule(tables);
    const service = mod.betaTestingService as unknown as {
      startSession: (testerId: string, deviceInfo: Record<string, unknown>) => Promise<string>;
      trackPageVisit: (sessionId: string, pageUrl: string) => Promise<void>;
      trackAction: (sessionId: string, action: string, element?: string, page?: string, metadata?: Record<string, unknown>) => Promise<void>;
      trackError: (sessionId: string, type: string, message: string, stack?: string) => Promise<void>;
      endSession: (sessionId: string) => Promise<void>;
      submitFeedback: (testerId: string, feedback: Record<string, unknown>) => Promise<{ success: boolean; feedbackId?: string }>;
      updateFeedbackStatus: (feedbackId: string, status: 'new' | 'triaged' | 'in_progress' | 'resolved' | 'wont_fix', notes?: string) => Promise<void>;
      submitNPSSurvey: (testerId: string, survey: Record<string, unknown>) => Promise<boolean>;
      notifyCriticalFeedback: (feedback: Record<string, unknown>) => Promise<void>;
      getFeedback: (filters?: Record<string, unknown>) => Promise<Row[]>;
    };

    tables.beta_testers.push({
      id: 'tester-1',
      email: 'active@v2-hub.test',
      name: 'Active Tester',
      role: 'external',
      status: 'active',
      invited_at: new Date().toISOString(),
      total_sessions: 0,
      total_feedback: 0,
    });

    vi.spyOn(service, 'notifyCriticalFeedback').mockResolvedValue();

    const sessionId = await service.startSession('tester-1', {
      user_agent: 'UA',
      platform: 'Win32',
      browser: 'Chrome',
      browser_version: '130',
      screen_width: 1920,
      screen_height: 1080,
      device_pixel_ratio: 1,
      language: 'en',
      timezone: 'UTC',
    });

    await service.trackPageVisit(sessionId, '/menu service');
    await service.trackAction(sessionId, 'click', 'button', '/menu service', { source: 'menu' });
    await service.trackError(sessionId, 'runtime', 'Boom', 'stack');
    await service.endSession(sessionId);

    expect(tables.beta_sessions.length).toBe(1);
    expect(tables.beta_sessions[0].duration_seconds).toBeTypeOf('number');

    const feedback = await service.submitFeedback('tester-1', {
      type: 'bug',
      severity: 'critical',
      category: 'checkout',
      title: 'Cannot place order',
      description: 'Submit button fails',
      device_info: {
        user_agent: 'UA',
        platform: 'Win32',
        browser: 'Chrome',
        browser_version: '130',
        screen_width: 1920,
        screen_height: 1080,
        device_pixel_ratio: 1,
        language: 'en',
        timezone: 'UTC',
      },
      page_url: '/checkout',
    });

    expect(feedback.success).toBe(true);
    expect(service.notifyCriticalFeedback).toHaveBeenCalled();

    const feedbackId = String(tables.beta_feedback[0].id);
    await service.updateFeedbackStatus(feedbackId, 'resolved', 'Fixed in sprint');
    expect(tables.beta_feedback[0].status).toBe('resolved');

    const npsSubmitted = await service.submitNPSSurvey('tester-1', {
      score: 9,
      would_recommend: true,
      feedback: 'Great',
    });
    expect(npsSubmitted).toBe(true);
    expect(tables.beta_nps_surveys.length).toBe(1);

    const filteredFeedback = await service.getFeedback({ status: 'resolved' });
    expect(filteredFeedback.length).toBe(1);
  });

  it('computes metrics and exposes device/widget helpers', async () => {
    const mod = await loadModule(tables);
    const service = mod.betaTestingService as unknown as {
      getBetaTesters: (filters?: Record<string, unknown>) => Promise<Row[]>;
      getBetaMetrics: () => Promise<Record<string, unknown>>;
    };

    tables.beta_testers.push(
      { id: 't1', status: 'active', role: 'external', invited_at: '2025-01-01' },
      { id: 't2', status: 'invited', role: 'vip', invited_at: '2025-01-02' }
    );
    tables.beta_sessions.push(
      {
        id: 's1',
        tester_id: 't1',
        duration_seconds: 120,
        actions_performed: [{ page: '/booking' }],
        errors_encountered: [{ message: 'e1' }],
      },
      {
        id: 's2',
        tester_id: 't1',
        duration_seconds: 180,
        actions_performed: [{ page: '/profile' }],
        errors_encountered: [],
      }
    );
    tables.beta_feedback.push(
      { id: 'f1', type: 'bug', severity: 'high', status: 'resolved' },
      { id: 'f2', type: 'feature', severity: 'low', status: 'new' }
    );
    tables.beta_nps_surveys.push({ id: 'n1', score: 8 }, { id: 'n2', score: 10 });

    const activeTesters = await service.getBetaTesters({ status: 'active' });
    expect(activeTesters).toHaveLength(1);

    const metrics = await service.getBetaMetrics();
    expect(metrics.total_testers).toBe(2);
    expect(metrics.active_testers).toBe(1);
    expect(metrics.total_sessions).toBe(2);
    expect(metrics.bugs_reported).toBe(1);
    expect(metrics.average_nps).toBe(9);

    const widget = mod.BetaFeedbackWidget();
    expect(widget).toContain('Submit Beta Feedback');

    const info = mod.collectDeviceInfo();
    expect(info).toHaveProperty('browser');
    expect(info).toHaveProperty('screen_width');
  });
});
