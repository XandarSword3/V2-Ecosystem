import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => {
  const MotionStub = ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>;
  const createMotionValue = (initial = 0) => ({
    get: () => initial,
    set: vi.fn(),
    on: vi.fn(),
  });
  return {
    motion: new Proxy({}, { get: () => MotionStub }),
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useScroll: () => ({ scrollYProgress: 0 }),
    useTransform: (value: { get?: () => number } | number) =>
      typeof value === 'number' ? value : value?.get?.() ?? 0,
    useSpring: (value: { get?: () => number } | number) =>
      typeof value === 'number' ? createMotionValue(value) : value,
    useMotionValue: (initial = 0) => createMotionValue(initial),
    useInView: () => true,
    useReducedMotion: () => false,
    useAnimation: () => ({
      start: vi.fn(),
      stop: vi.fn(),
    }),
    useCycle: (...items: any[]) => [items[0], vi.fn()],
  };
});

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    settings: {
      resortName: 'V2 Resort',
      tagline: 'Luxury and comfort',
      weatherEffect: 'rain',
      showWeatherWidget: true,
    },
    loading: false,
  }),
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector?: (state: {
    enableLoadingAnimation: boolean;
    enableTransitions: boolean;
    transitionStyle: string;
  }) => unknown) => {
    const state = {
      enableLoadingAnimation: false,
      enableTransitions: true,
      transitionStyle: 'fade',
    };
    return selector ? selector(state) : state;
  },
}));

import { AnimatedCounter, AnimatedStat, AnimatedStatsRow } from '../../src/components/effects/AnimatedCounter';
import { AuroraBackground, AuroraSection } from '../../src/components/effects/AuroraBackground';
import { BentoCard, BentoFeatureCard, BentoGrid } from '../../src/components/effects/BentoGrid';
import { Card3D, FloatingCard, TiltCard } from '../../src/components/effects/Card3D';
import { GlowingBorder, MagneticButton, SpotlightCard } from '../../src/components/effects/GlowingBorder';
import LoadingScreen, {
  LoadingScreenWrapper,
} from '../../src/components/effects/LoadingScreen';
import { PageLoader } from '../../src/components/ui/Skeleton';
import PageTransition, {
  AnimatedSection,
  LuxuryReveal,
  SlideReveal,
  StaggeredContainer,
  StaggeredItem,
} from '../../src/components/effects/PageTransition';
import {
  BlurReveal,
  GradientText,
  HighlightText,
  HoverLetters,
  RevealHeading,
  StaggerText,
  TypewriterText,
} from '../../src/components/effects/TextEffects';
import WeatherEffects from '../../src/components/effects/WeatherEffects';

describe('effects components', () => {
  it('renders animated counters and stat rows', () => {
    render(
      <>
        <AnimatedCounter value={120} prefix="$" />
        <AnimatedStat label="Bookings" value={42} />
        <AnimatedStatsRow stats={[{ label: 'Guests', value: 10 }, { label: 'Revenue', value: 900 }]} />
      </>
    );

    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('Guests')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('renders aurora, bento, and card effects wrappers', () => {
    render(
      <>
        <AuroraBackground>
          <span>Aurora content</span>
        </AuroraBackground>
        <AuroraSection>
          <span>Section content</span>
        </AuroraSection>
        <BentoGrid>
          <BentoCard>
            <h3>Card One</h3>
            <p>First</p>
          </BentoCard>
          <BentoFeatureCard title="Feature" description="Desc" icon={<span>f</span>} href="/features" />
        </BentoGrid>
        <Card3D>
          <span>3D card</span>
        </Card3D>
        <TiltCard>
          <span>Tilt card</span>
        </TiltCard>
        <FloatingCard>
          <span>Floating card</span>
        </FloatingCard>
      </>
    );

    expect(screen.getByText('Aurora content')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
    expect(screen.getByText('3D card')).toBeInTheDocument();
  });

  it('renders glowing border and page transition helpers', () => {
    render(
      <>
        <GlowingBorder>
          <span>Glow child</span>
        </GlowingBorder>
        <SpotlightCard>
          <span>Spotlight child</span>
        </SpotlightCard>
        <MagneticButton>Magnetic CTA</MagneticButton>
        <PageTransition>
          <span>Page body</span>
        </PageTransition>
        <AnimatedSection>
          <span>Animated section</span>
        </AnimatedSection>
        <StaggeredContainer>
          <StaggeredItem>
            <span>Stagger item</span>
          </StaggeredItem>
        </StaggeredContainer>
        <LuxuryReveal>
          <span>Luxury reveal</span>
        </LuxuryReveal>
        <SlideReveal>
          <span>Slide reveal</span>
        </SlideReveal>
      </>
    );

    expect(screen.getByText('Magnetic CTA')).toBeInTheDocument();
    expect(screen.getByText('Animated section')).toBeInTheDocument();
    expect(screen.getByText('Slide reveal')).toBeInTheDocument();
  });

  it('renders text effects and advances typewriter text', () => {
    vi.useFakeTimers();

    render(
      <>
        <GradientText>Gradient words</GradientText>
        <TypewriterText text="Typewriter" speed={20} />
        <StaggerText>Stagger me</StaggerText>
        <RevealHeading>Reveal title</RevealHeading>
        <BlurReveal>Blur text</BlurReveal>
        <HighlightText>Highlight text</HighlightText>
        <HoverLetters>Hover me</HoverLetters>
      </>
    );

    expect(screen.getByText('Gradient words')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(240);
    });

    expect(
      screen.getByText((_, node) => node?.textContent === 'Typewriter')
    ).toBeInTheDocument();
    expect(screen.getByText('Reveal title')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('renders loading screens and weather effects with mocked settings', () => {
    render(
      <>
        <LoadingScreen minDuration={0} />
        <LoadingScreenWrapper minDuration={0}>
          <span>Wrapped content</span>
        </LoadingScreenWrapper>
        <PageLoader />
        <WeatherEffects />
      </>
    );

    expect(screen.getByText('Wrapped content')).toBeInTheDocument();
  });
});
