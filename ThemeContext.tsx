
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Palettes } from './Theme';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: (event?: React.MouseEvent | any) => void;
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

  const toggleTheme = (event?: React.MouseEvent) => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    const isDark = mode === 'dark'; // before change

    if (!document.startViewTransition || !event) {
      setMode(nextMode);
      return;
    }

    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      setMode(nextMode);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 750,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    });
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
