
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '../../Theme';
import { ParticleBurst } from './ParticleBurst';

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  type?: "button" | "submit" | "reset";
  noBurst?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  onClick, 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  style,
  className,
  type = "button",
  noBurst = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [showBurst, setShowBurst] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    if (!noBurst) {
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 500);
    }
    onClick?.();
  };

  // --- Styles ---
  const baseStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'visible', // Allow particles to escape
    border: 'none',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    borderRadius: DS.Radius.Full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    ...DS.Type.Readable.Label,
    transition: 'color 0.2s ease',
  };

  const variants = {
    primary: {
      background: DS.Color.Accent.Surface,
      color: DS.Color.Accent.Content,
      border: 'none',
    },
    secondary: {
      background: DS.Color.Base.Surface[2],
      color: DS.Color.Base.Content[1],
      border: `1px solid ${DS.Color.Base.Border}`,
    },
    ghost: {
      background: 'transparent',
      color: DS.Color.Base.Content[1],
      border: 'none',
    },
    icon: {
      background: 'transparent',
      color: DS.Color.Base.Content[1],
      border: 'none',
      padding: 0,
    }
  };

  const sizes = {
    sm: { padding: '6px 12px', fontSize: '12px' },
    md: { padding: '12px 24px', fontSize: '14px' },
    lg: { padding: '16px 32px', fontSize: '16px' },
    icon: { padding: '8px', width: '40px', height: '40px' }
  };

  const appliedStyle = {
    ...baseStyle,
    ...variants[variant],
    ...sizes[size],
    ...(variant === 'icon' ? sizes.icon : {}),
    ...style // Ensure style prop overrides variant defaults
  };

  return (
    <motion.button
      type={type}
      onClick={handleClick}
      disabled={disabled}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onTapStart={() => setIsPressed(true)}
      onTapCancel={() => setIsPressed(false)}
      onTap={() => setIsPressed(false)}
      style={appliedStyle}
      className={className}
      layout
    >
      {/* Particles Reaction */}
      {showBurst && !noBurst && <ParticleBurst />}

      {/* State Layer (Absolute Overlay) */}
      <AnimatePresence>
        {(isHovered || isPressed) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: isPressed ? 0.2 : 0.1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={DS.Motion.Spring.Snappy}
            style={{
              position: 'absolute',
              inset: 0,
              background: variant === 'primary' ? '#000' : '#FFF', // Contrast layer
              borderRadius: 'inherit',
              pointerEvents: 'none',
              zIndex: 0,
              overflow: 'hidden' // Clip overlay to button shape
            }}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      <motion.div 
        style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}
        animate={{ scale: isPressed ? 0.95 : 1 }}
      >
        {children}
      </motion.div>
    </motion.button>
  );
};
