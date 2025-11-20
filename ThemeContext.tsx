
import React, { createContext, useContext, useState, useEffect } from 'react';
import { themeConfigs } from './Theme';

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
    const config = themeConfigs[mode];
    
    root.style.setProperty('--surface-1', config.surface1);
    root.style.setProperty('--surface-2', config.surface2);
    root.style.setProperty('--surface-3', config.surface3);
    root.style.setProperty('--text-1', config.text1);
    root.style.setProperty('--text-2', config.text2);
    root.style.setProperty('--text-3', config.text3);
    root.style.setProperty('--accent', config.accent);
    root.style.setProperty('--danger', config.danger);
    root.style.setProperty('--border', config.border);
    root.style.setProperty('--glass', config.glass);
    root.style.setProperty('--input-bg', config.inputBg);
    
    // Meta theme color update for browser chrome integration
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', config.surface1);
    } else {
        const meta = document.createElement('meta');
        meta.name = "theme-color";
        meta.content = config.surface1;
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
