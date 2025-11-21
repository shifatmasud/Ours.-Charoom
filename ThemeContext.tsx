
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Palettes } from './Theme';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ mode: 'dark', toggleTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    const root = document.documentElement;
    const palette = mode === 'dark' ? Palettes.Dark : Palettes.Light;
    
    // Map Palette to CSS Variables for DS
    root.style.setProperty('--ds-surface-1', palette.Surface1);
    root.style.setProperty('--ds-surface-2', palette.Surface2);
    root.style.setProperty('--ds-surface-3', palette.Surface3);
    root.style.setProperty('--ds-content-1', palette.Content1);
    root.style.setProperty('--ds-content-2', palette.Content2);
    root.style.setProperty('--ds-content-3', palette.Content3);
    root.style.setProperty('--ds-accent', palette.Accent);
    root.style.setProperty('--ds-error', palette.Error);
    root.style.setProperty('--ds-border', palette.Border);
    root.style.setProperty('--ds-glass', palette.Glass);
    
    // Meta theme color update
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', palette.Surface1);
    } else {
        const meta = document.createElement('meta');
        meta.name = "theme-color";
        meta.content = palette.Surface1;
        document.head.appendChild(meta);
    }
  }, [mode]);

  const toggleTheme = () => {
    setMode(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
