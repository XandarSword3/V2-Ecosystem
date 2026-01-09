'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
// import { Switch } from '@/components/ui/Switch'; // Assuming a Switch component is available in ui
import { FontSelector } from './FontSelector';
import { ColorPicker } from './ColorPicker';

interface WeatherWidgetConfigProps {
  weatherWidgetEnabledName: string;
  weatherWidgetLocationName: string;
  weatherWidgetColorPickerName?: string; // Optional for color picker
  weatherWidgetFontSelectorName?: string; // Optional for font selector
}

export const WeatherWidgetConfig: React.FC<WeatherWidgetConfigProps> = ({
  weatherWidgetEnabledName,
  weatherWidgetLocationName,
  weatherWidgetColorPickerName,
  weatherWidgetFontSelectorName,
}) => {
  const { watch } = useFormContext();
  const isWeatherWidgetEnabled = watch(weatherWidgetEnabledName);

  // Dummy options for font selector, replace with actual available fonts
  const fontOptions = [
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
    { value: 'Times New Roman, serif', label: 'Times New Roman' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: 'var(--font-arabic)', label: 'Arabic Font' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <label htmlFor={weatherWidgetEnabledName} className="block text-sm font-medium text-gray-700">
          Enable Weather Widget
        </label>
        <input type="checkbox" id={weatherWidgetEnabledName} name={weatherWidgetEnabledName} />
      </div>

      {isWeatherWidgetEnabled && (
        <div className="space-y-4 ml-6"> {/* Indent nested settings */}
          <div>
            <label htmlFor={weatherWidgetLocationName} className="block text-sm font-medium text-gray-700">
              Weather Widget Location
            </label>
            <input
              type="text"
              id={weatherWidgetLocationName}
              {...useFormContext().register(weatherWidgetLocationName)}
              className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {weatherWidgetColorPickerName && (
            <ColorPicker name={weatherWidgetColorPickerName} label="Weather Widget Text Color" />
          )}

          {weatherWidgetFontSelectorName && (
            <FontSelector
              name={weatherWidgetFontSelectorName}
              label="Weather Widget Font"
              options={fontOptions}
            />
          )}
        </div>
      )}
    </div>
  );
};