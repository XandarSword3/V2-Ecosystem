'use client';

import React, { useState, useEffect } from 'react';
import { FontSelector } from './FontSelector';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ThemeSettings {
  primary_color: string;
  secondary_color: string;
  font_family: string;
  weather_widget_enabled: boolean;
  weather_widget_location: string;
}

const fetchThemeSettings = async (): Promise<ThemeSettings> => {
  const response = await fetch('/api/theme');
  if (!response.ok) {
    throw new Error('Failed to fetch theme settings');
  }
  const data = await response.json();
  return data; // Assuming the API returns an array, and we only care about the first item
};

const updateThemeSettings = async (settings: ThemeSettings): Promise<ThemeSettings> => {
  const response = await fetch('/api/theme', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to update theme settings');
  }
  return response.json();
};

export function ThemeSettingsForm() {
  const queryClient = useQueryClient();
  const { data: initialSettings, isLoading, isError, error } = useQuery<ThemeSettings, Error>({
    queryKey: ['themeSettings'],
    queryFn: fetchThemeSettings,
  });

  const { register, handleSubmit, reset, formState: { errors }, control } = useForm<ThemeSettings>();

  const mutation = useMutation({
    mutationFn: updateThemeSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['themeSettings'], data);
      toast.success('Theme settings updated successfully!');
    },
    onError: (error) => {
      toast.error(`Error updating theme settings: ${error.message}`);
    },
  });

  useEffect(() => {
    if (initialSettings) {
      reset(initialSettings);
    }
  }, [initialSettings, reset]);

  const onSubmit: SubmitHandler<ThemeSettings> = (data) => {
    mutation.mutate(data);
  };

  if (isLoading) return <p>Loading theme settings...</p>;
  if (isError && error) return <p>Error loading theme settings: {error.message}</p>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label htmlFor="primary_color" className="block text-sm font-medium text-gray-700">
          Primary Color
        </label>
        <input
          type="color"
          id="primary_color"
          {...register('primary_color')}
          className="mt-1 block w-full h-10 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="secondary_color" className="block text-sm font-medium text-gray-700">
          Secondary Color
        </label>
        <input
          type="color"
          id="secondary_color"
          {...register('secondary_color')}
          className="mt-1 block w-full h-10 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="font_family" className="block text-sm font-medium text-gray-700">
          Font Family
        </label>
        <FontSelector
          name="font_family"
          label="Font Family"
          options={[
            { value: 'Arial, sans-serif', label: 'Arial' },
            { value: 'Verdana, sans-serif', label: 'Verdana' },
            { value: 'Times New Roman, serif', label: 'Times New Roman' },
            { value: 'Georgia, serif', label: 'Georgia' },
            { value: 'var(--font-arabic)', label: 'Arabic Font' }, // Use CSS variable
          ]}
          defaultValue={initialSettings?.font_family}
        />
      </div>

      <div className="flex items-center">
        <input
          id="weather_widget_enabled"
          type="checkbox"
          {...register('weather_widget_enabled')}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
        />
        <label htmlFor="weather_widget_enabled" className="ml-2 block text-sm text-gray-700">
          Enable Weather Widget
        </label>
      </div>

      {/* Conditionally render location input if weather widget is enabled */}
      {true && ( // This condition will be replaced by the actual state of weather_widget_enabled
        <div>
          <label htmlFor="weather_widget_location" className="block text-sm font-medium text-gray-700">
            Weather Widget Location
          </label>
          <input
            type="text"
            id="weather_widget_location"
            {...register('weather_widget_location')}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      )}

      <button
        type="submit"
        className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Save Theme Settings
      </button>
    </form>
  );
}