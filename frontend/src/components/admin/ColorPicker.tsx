'use client';

import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

interface ColorPickerProps {
  name: string;
  label: string;
  defaultValue?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ name, label, defaultValue }) => {
  const { register, watch, setValue } = useFormContext();
  const currentColor = watch(name, defaultValue);

  useEffect(() => {
    // Set the initial value if it's not already set
    if (defaultValue && !currentColor) {
      setValue(name, defaultValue);
    }
  }, [defaultValue, currentColor, name, setValue]);

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1 flex items-center">
        <input
          type="color"
          id={name}
          {...register(name)}
          className="h-10 w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
        <span className="ml-3 text-sm text-gray-500">{currentColor}</span>
      </div>
    </div>
  );
};