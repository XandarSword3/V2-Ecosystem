/**
 * Tests for settingsStore (Zustand)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, exchangeRates, currencySymbols, currencyNames } from '@/stores/settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      animationsEnabled: true,
      reducedMotion: false,
      soundEnabled: true,
      notificationSound: true,
      currency: 'USD',
      enableTransitions: true,
      transitionStyle: 'reveal',
      enableLoadingAnimation: true,
    });
  });

  it('starts with default values', () => {
    const state = useSettingsStore.getState();
    expect(state.animationsEnabled).toBe(true);
    expect(state.reducedMotion).toBe(false);
    expect(state.soundEnabled).toBe(true);
    expect(state.notificationSound).toBe(true);
    expect(state.currency).toBe('USD');
    expect(state.enableTransitions).toBe(true);
    expect(state.transitionStyle).toBe('reveal');
  });

  it('setAnimationsEnabled toggles animations', () => {
    useSettingsStore.getState().setAnimationsEnabled(false);
    expect(useSettingsStore.getState().animationsEnabled).toBe(false);
  });

  it('setReducedMotion toggles reduced motion', () => {
    useSettingsStore.getState().setReducedMotion(true);
    expect(useSettingsStore.getState().reducedMotion).toBe(true);
  });

  it('setSoundEnabled toggles sound', () => {
    useSettingsStore.getState().setSoundEnabled(false);
    expect(useSettingsStore.getState().soundEnabled).toBe(false);
  });

  it('setNotificationSound toggles notification sound', () => {
    useSettingsStore.getState().setNotificationSound(false);
    expect(useSettingsStore.getState().notificationSound).toBe(false);
  });

  it('setCurrency changes currency', () => {
    useSettingsStore.getState().setCurrency('EUR');
    expect(useSettingsStore.getState().currency).toBe('EUR');

    useSettingsStore.getState().setCurrency('LBP');
    expect(useSettingsStore.getState().currency).toBe('LBP');
  });

  it('setEnableTransitions toggles transitions', () => {
    useSettingsStore.getState().setEnableTransitions(false);
    expect(useSettingsStore.getState().enableTransitions).toBe(false);
  });

  it('setTransitionStyle changes transition style', () => {
    useSettingsStore.getState().setTransitionStyle('fade');
    expect(useSettingsStore.getState().transitionStyle).toBe('fade');

    useSettingsStore.getState().setTransitionStyle('slideRight');
    expect(useSettingsStore.getState().transitionStyle).toBe('slideRight');
  });

  it('setEnableLoadingAnimation toggles loading animation', () => {
    useSettingsStore.getState().setEnableLoadingAnimation(false);
    expect(useSettingsStore.getState().enableLoadingAnimation).toBe(false);
  });
});

describe('currency constants', () => {
  it('exchangeRates has USD as 1', () => {
    expect(exchangeRates.USD).toBe(1);
  });

  it('exchangeRates has EUR < 1', () => {
    expect(exchangeRates.EUR).toBeLessThan(1);
    expect(exchangeRates.EUR).toBeGreaterThan(0);
  });

  it('exchangeRates has LBP > 1', () => {
    expect(exchangeRates.LBP).toBeGreaterThan(1000);
  });

  it('currencySymbols has correct symbols', () => {
    expect(currencySymbols.USD).toBe('$');
    expect(currencySymbols.EUR).toBe('€');
    expect(currencySymbols.LBP).toBe('ل.ل');
  });

  it('currencyNames has correct names', () => {
    expect(currencyNames.USD).toBe('US Dollar');
    expect(currencyNames.EUR).toBe('Euro');
    expect(currencyNames.LBP).toBe('Lebanese Pound');
  });
});
