import { describe, expect, it } from 'vitest';

import {
  badgePop,
  bouncyTransition,
  buttonBouncyHover,
  buttonHover,
  cardHover,
  counterAnimation,
  elegantTransition,
  fadeIn,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  fadeInUp,
  floatAnimation,
  modalBackdrop,
  modalContent,
  notificationSlide,
  orderCardSlide,
  pageSlideUp,
  pageTransition,
  popIn,
  pulseAnimation,
  scaleIn,
  scaleInBouncy,
  shimmerAnimation,
  slideUpModal,
  smoothTransition,
  spinAnimation,
  springTransition,
  staggerContainer,
  staggerContainerFast,
  staggerContainerSlow,
  staggerItem,
  staggerItemScale,
  statusChange,
} from '../../src/lib/animations/presets';

describe('animation presets', () => {
  it('exports transition presets with expected shapes', () => {
    expect(springTransition.type).toBe('spring');
    expect(smoothTransition.type).toBe('spring');
    expect(bouncyTransition.type).toBe('spring');
    expect(elegantTransition.duration).toBeGreaterThan(0);
  });

  it('contains base enter/exit variants for core transitions', () => {
    [fadeIn, fadeInUp, fadeInDown, fadeInLeft, fadeInRight, scaleIn, scaleInBouncy, popIn].forEach(
      preset => {
        expect(preset.hidden).toBeTruthy();
        expect(preset.visible).toBeTruthy();
        expect(preset.exit).toBeTruthy();
      }
    );

    expect(pageTransition.visible).toBeTruthy();
    expect(pageSlideUp.exit).toBeTruthy();
  });

  it('contains stagger and interaction presets for cards and buttons', () => {
    [staggerContainer, staggerContainerFast, staggerContainerSlow, staggerItem, staggerItemScale].forEach(
      preset => {
        expect(preset.hidden).toBeTruthy();
        expect(preset.visible).toBeTruthy();
      }
    );

    expect(cardHover.hover).toBeTruthy();
    expect(buttonHover.tap).toBeTruthy();
    expect(buttonBouncyHover.hover).toBeTruthy();
  });

  it('contains utility animations for effects, modals, and notifications', () => {
    [floatAnimation, pulseAnimation, shimmerAnimation, spinAnimation].forEach(preset => {
      expect(preset.hidden).toBeTruthy();
      expect(preset.visible).toBeTruthy();
    });

    [orderCardSlide, statusChange, counterAnimation, modalBackdrop, modalContent, slideUpModal, notificationSlide, badgePop].forEach(
      preset => {
        expect(preset.hidden).toBeTruthy();
        expect(preset.visible).toBeTruthy();
      }
    );
  });
});
