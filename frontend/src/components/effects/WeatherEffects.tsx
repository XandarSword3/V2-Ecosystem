/**
 * WeatherEffects — effects removed, neutral passthrough retained.
 * Weather canvas overlay gone; renders nothing (was cosmetic only).
 */
import React from 'react';

interface Props {
  condition?: string; // ignored
  intensity?: number; // ignored
}

export function WeatherEffects(_props: Props) {
  return null;
}
