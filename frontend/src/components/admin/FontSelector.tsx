'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';

interface FontSelectorProps {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}

export const FontSelector: React.FC<FontSelectorProps> = ({ name, label, options, defaultValue }) => {
  const { register, watch, setValue } = useFormContext();
  const currentFont = watch(name, defaultValue);

  React.useEffect(() => {
    // Set the initial value if it's not already set
    if (defaultValue && !currentFont) {
      setValue(name, defaultValue);
    }
  }, [defaultValue, currentFont, name, setValue]);

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={name}
        {...register(name)}
        className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};