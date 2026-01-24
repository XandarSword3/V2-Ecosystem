import { NextResponse } from 'next/server';

export async function GET() {
  const defaultTheme = {
    theme: 'beach',
    colors: {
      primary: '#0ea5e9',
      accent: '#6366f1',
      background: '#f8fafc',
      text: '#1e293b',
    },
  };

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl.replace(/\/api\/?$/, '')}/api/settings`, {
      // Forward cookies if needed for SSR auth, but for public settings usually not needed
      next: { revalidate: 60 }, // ISR: cache for 60s
    });
    if (!res.ok) {
      return NextResponse.json(defaultTheme);
    }
    const data = await res.json();
    if (data.success && data.data) {
      // Prefer appearance object if present, else fallback to root
      const appearance = data.data.appearance || data.data;
      return NextResponse.json({
        theme: appearance.theme || 'beach',
        colors: appearance.themeColors || defaultTheme.colors,
      });
    }
    return NextResponse.json(defaultTheme);
  } catch (err) {
    // Fallback to static if backend is down
    return NextResponse.json({
      ...defaultTheme,
      error: 'Backend unavailable',
    });
  }
}
