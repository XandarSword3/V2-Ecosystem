/**
 * Tests for authStore (Zustand)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      token: null,
    });
  });

  it('starts with unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('login sets user and token', () => {
    const user = { id: '1', name: 'John', email: 'john@test.com', role: 'admin' };
    const token = 'jwt-token-123';

    useAuthStore.getState().login(user, token);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.token).toBe(token);
  });

  it('logout clears user and token', () => {
    const user = { id: '1', name: 'John', email: 'john@test.com', role: 'admin' };
    useAuthStore.getState().login(user, 'token');
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('login overrides previous user', () => {
    const user1 = { id: '1', name: 'John', email: 'john@test.com', role: 'admin' };
    const user2 = { id: '2', name: 'Jane', email: 'jane@test.com', role: 'staff' };

    useAuthStore.getState().login(user1, 'token1');
    useAuthStore.getState().login(user2, 'token2');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user2);
    expect(state.token).toBe('token2');
  });
});
