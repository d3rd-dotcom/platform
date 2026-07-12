'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';

type Theme = 'light' | 'dark';

// Color themes are orthogonal to light/dark. They retint the accent and add a
// soft page wash so users can pick a calmer, lower-stimulation palette — an
// accessibility option for light-sensitive and neurodivergent users.
export type ColorTheme = 'default' | 'teal' | 'sage' | 'lavender' | 'rose' | 'amber' | 'neutral';

export interface ColorThemeOption {
  id: ColorTheme;
  label: string;
}

export const COLOR_THEMES: ColorThemeOption[] = [
  { id: 'default', label: 'Academy' },
  { id: 'teal', label: 'Teal' },
  { id: 'sage', label: 'Sage' },
  { id: 'lavender', label: 'Lavender' },
  { id: 'rose', label: 'Rose' },
  { id: 'amber', label: 'Amber' },
  { id: 'neutral', label: 'Neutral' },
];

const COLOR_THEME_IDS = COLOR_THEMES.map((c) => c.id);

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  colorTheme: ColorTheme;
  setColorTheme: (color: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
  colorTheme: 'default',
  setColorTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  const [theme, setThemeState] = useState<Theme>('light');
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('default');

  useEffect(() => {
    const stored = getStorageItem('mwa-theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') {
      setThemeState(stored);
    } else {
      setThemeState('light');
      setStorageItem('mwa-theme', 'light');
    }

    const storedColor = getStorageItem('mwa-color-theme') as ColorTheme | null;
    if (storedColor && COLOR_THEME_IDS.includes(storedColor)) {
      setColorThemeState(storedColor);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isLandingPage) {
      root.removeAttribute('data-theme');
      root.removeAttribute('data-color');
    } else {
      root.setAttribute('data-theme', theme);
      if (colorTheme === 'default') {
        root.removeAttribute('data-color');
      } else {
        root.setAttribute('data-color', colorTheme);
      }
    }
  }, [theme, colorTheme, isLandingPage]);

  // The landing page ('/') renders outside the authenticated shell, so this
  // provider unmounts when navigating to it. Clear the theme attributes on
  // unmount so themed styles don't leak onto the un-themed landing page.
  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.removeAttribute('data-color');
    };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setStorageItem('mwa-theme', t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const setColorTheme = useCallback((c: ColorTheme) => {
    setColorThemeState(c);
    setStorageItem('mwa-color-theme', c);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
