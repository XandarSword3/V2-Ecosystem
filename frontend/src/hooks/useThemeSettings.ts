import { useQuery } from '@tanstack/react-query';

interface ThemeSettings {
  primary_color: string;
  secondary_color: string;
  font_family: string;
}

const fetchThemeSettings = async (): Promise<ThemeSettings> => {
  const response = await fetch('/api/theme');
  if (!response.ok) {
    throw new Error('Failed to fetch theme settings');
  }
  const data = await response.json();
  // Assuming the API returns an array, and we only care about the first item
  return data; 
};

export const useThemeSettings = () => {
  return useQuery<ThemeSettings, Error>({
    queryKey: ['themeSettings'],
    queryFn: fetchThemeSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};