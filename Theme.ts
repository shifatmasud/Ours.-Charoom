

// --- Tier 2: Design System ---

export const Palettes = {
  Dark: {
    Surface1: '#000000', // Pure Void
    Surface2: '#111111', // Near Void
    Surface3: '#1F1F1F', // Elevated
    Content1: '#FFFFFF', // Pure Light
    Content2: '#A1A1AA', // Dimmed
    Content3: '#52525B', // Muted
    Accent: '#FF4F1F',   // Electric Orange
    Error: '#FF3333',
    Border: 'rgba(255,255,255,0.12)',
    Glass: 'rgba(0,0,0,0.6)'
  },
  Light: {
    Surface1: '#FFFFFF', // Pure Light
    Surface2: '#F4F4F5', // Soft Grey
    Surface3: '#E4E4E7', // Structure
    Content1: '#09090B', // Ink
    Content2: '#52525B', // Pencil
    Content3: '#A1A1AA', // Ghost
    Accent: '#FF4F1F',   // Electric Orange
    Error: '#DC2626',
    Border: 'rgba(0,0,0,0.08)',
    Glass: 'rgba(255,255,255,0.8)'
  }
};

// Semantic Token Mapping
export const DS = {
  Color: {
    Base: {
      Surface: {
        1: 'var(--ds-surface-1)',
        2: 'var(--ds-surface-2)',
        3: 'var(--ds-surface-3)',
      },
      Content: {
        1: 'var(--ds-content-1)',
        2: 'var(--ds-content-2)',
        3: 'var(--ds-content-3)',
      },
      Border: 'var(--ds-border)',
      Glass: 'var(--ds-glass)',
    },
    Accent: {
      Surface: 'var(--ds-accent)',
      Content: '#FFFFFF',
    },
    Status: {
      Error: 'var(--ds-error)'
    }
  },
  Type: {
    Expressive: {
      Display: {
        fontFamily: '"Bebas Neue", sans-serif',
        lineHeight: '1.1',
        letterSpacing: '0.02em'
      },
      Quote: {
        fontFamily: '"Comic Neue", cursive',
        fontWeight: 400
      }
    },
    Readable: {
      Body: {
        fontFamily: '"Inter", sans-serif',
        lineHeight: '1.5'
      },
      Label: {
        fontFamily: '"Inter", sans-serif',
        fontWeight: 500,
        letterSpacing: '0.01em'
      }
    }
  },
  Spacing: {
    Base: 4,
    S: '8px',
    M: '16px',
    L: '24px',
    XL: '32px',
    XXL: '64px',
  },
  Radius: {
    S: '8px',
    M: '16px',
    L: '24px',
    Full: '9999px'
  },
  Effect: {
    Shadow: {
      Soft: '0px 8px 32px rgba(0,0,0,0.08)',
      Glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
    },
    Blur: {
      Glass: 'blur(16px)',
    }
  },
  Motion: {
    // 100ms Fluid Motion System
    Spring: {
      Gentle: { type: 'spring' as const, stiffness: 120, damping: 20, mass: 1 },
      Snappy: { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 },
      Bouncy: { type: 'spring' as const, stiffness: 400, damping: 15, mass: 1.2 }
    },
    Duration: {
      Fast: 0.1,
      Normal: 0.3,
      Slow: 0.6
    }
  }
};

// Legacy/Bridge Theme object to support existing components
export const theme = {
  colors: {
    surface1: DS.Color.Base.Surface[1],
    surface2: DS.Color.Base.Surface[2],
    surface3: DS.Color.Base.Surface[3],
    text1: DS.Color.Base.Content[1],
    text2: DS.Color.Base.Content[2],
    text3: DS.Color.Base.Content[3],
    accent: DS.Color.Accent.Surface,
    danger: DS.Color.Status.Error,
    border: DS.Color.Base.Border,
    inputBg: DS.Color.Base.Surface[2],
  },
  fonts: {
    display: DS.Type.Expressive.Display.fontFamily,
    body: DS.Type.Readable.Body.fontFamily,
  },
  layout: {
    maxWidth: '600px',
  },
  motion: {
    page: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.3 }
    },
    gentle: DS.Motion.Spring.Gentle,
  },
  radius: {
    md: DS.Radius.M,
    lg: DS.Radius.L,
    xl: DS.Radius.L,
    full: DS.Radius.Full,
  },
  shadow: {
    soft: DS.Effect.Shadow.Soft,
    card: '0 2px 8px rgba(0,0,0,0.1)',
  }
};

export const commonStyles = {
  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageContainer: {
    minHeight: '100vh',
    width: '100%',
    background: DS.Color.Base.Surface[1],
    color: DS.Color.Base.Content[1],
    display: 'flex',
    justifyContent: 'center',
  },
  inputReset: {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    width: '100%',
    fontFamily: 'inherit',
    color: 'inherit',
  }
};