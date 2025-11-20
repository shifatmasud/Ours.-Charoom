
export const themeConfigs = {
  dark: {
    surface1: '#000000', // Pure Black
    surface2: '#18181B', // Zinc 900 - Distinct from black
    surface3: '#27272A', // Zinc 800 - Card/Elevated
    text1: '#FFFFFF',    // High Emphasis
    text2: '#E4E4E7',    // Zinc 200 - High readability (>10:1)
    text3: '#A1A1AA',    // Zinc 400 - Medium readability (>4.5:1)
    accent: '#FF4F1F',   // High Vis Orange-Red
    danger: '#EF4444',   // Red 500
    border: 'rgba(255, 255, 255, 0.15)',
    glass: 'rgba(24, 24, 27, 0.85)', 
    inputBg: 'rgba(255, 255, 255, 0.08)',  // Soft Translucent Glassy for Dark Mode
  },
  light: {
    surface1: '#FFFFFF', // Pure White
    surface2: '#F4F4F5', // Zinc 100
    surface3: '#E4E4E7', // Zinc 200
    text1: '#09090B',    // Zinc 950 - High Emphasis
    text2: '#3F3F46',    // Zinc 700 - Much darker for readability
    text3: '#52525B',    // Zinc 600 - accessible gray
    accent: '#D02A00',   // Deep Orange
    danger: '#DC2626',   // Red 600
    border: 'rgba(0, 0, 0, 0.12)',
    glass: 'rgba(255, 255, 255, 0.9)', 
    inputBg: 'rgba(0, 0, 0, 0.05)',  // Soft Translucent Glassy for Light Mode
  }
};

export const theme = {
  colors: {
    surface1: 'var(--surface-1)',
    surface2: 'var(--surface-2)',
    surface3: 'var(--surface-3)',
    text1: 'var(--text-1)',
    text2: 'var(--text-2)',
    text3: 'var(--text-3)',
    accent: 'var(--accent)',
    accentHover: 'var(--accent)',
    glass: 'var(--glass)',
    inputBg: 'var(--input-bg)',
    border: 'var(--border)',
    danger: 'var(--danger)',
    overlay: 'rgba(0,0,0,0.8)',
  },
  fonts: {
    display: '"Bebas Neue", sans-serif',
    body: '"Inter", sans-serif',
    raw: '"Comic Neue", cursive',
  },
  radius: {
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    full: '9999px',
  },
  shadow: {
    soft: '0 4px 20px rgba(0,0,0,0.08)', 
    glow: '0 0 20px rgba(255, 79, 31, 0.3)',
    card: '0 2px 8px rgba(0,0,0,0.05)',
  },
  layout: {
    width: '100%',
    maxWidth: '500px', 
  },
  motion: {
    spring: { type: 'spring', stiffness: 180, damping: 24, mass: 0.8 }, 
    gentle: { type: 'spring', stiffness: 80, damping: 25, mass: 1.2 }, 
    tactile: { type: 'spring', stiffness: 300, damping: 30 },
    stagger: 0.08,
    page: {
      initial: { opacity: 0, filter: 'blur(4px)' },
      animate: { opacity: 1, filter: 'blur(0px)' },
      exit: { opacity: 0, filter: 'blur(4px)' },
      transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
    }
  }
};

export const commonStyles = {
  glassPanel: {
    background: theme.colors.glass,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: `1px solid ${theme.colors.border}`,
  },
  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputReset: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    width: '100%',
    color: theme.colors.text1,
    fontFamily: theme.fonts.body,
  },
  pageContainer: {
    minHeight: '100dvh', /* Dynamic viewport height for mobile */
    background: theme.colors.surface1, 
    display: 'flex', 
    justifyContent: 'center',
    width: '100%',
    transition: 'background-color 0.6s cubic-bezier(0.22, 1, 0.36, 1), color 0.6s cubic-bezier(0.22, 1, 0.36, 1)'
  }
};
