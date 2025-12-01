import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DS } from '../../Theme';
import { ParticleBurst } from './ParticleBurst';
import { StateLayer } from './StateLayer';

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
  
  // State Layer Coordinates
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [dims, setDims] = useState({ width: 0, height: 0 });

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    if (!noBurst) {
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 500);
    }
    onClick?.();
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDims({ width: rect.width, height: rect.height });
    setIsHovered(true);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    setIsPressed(false);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setDims({ width: rect.width, height: rect.height });
    setIsPressed(true);
  };

  const handlePointerUp = () => {
    setIsPressed(false);
  };

  // --- Styles ---
  const baseStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'visible', // Allow particles to escape, we clip StateLayer internally
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

  const rippleColor = variant === 'primary' ? DS.Color.Accent.Content : DS.Color.Base.Content[1];

  return (
    <motion.button
      type={type}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      disabled={disabled}
      style={appliedStyle}
      className={className}
      layout
    >
      {/* Clipping Container for State Layer */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
         <StateLayer 
            color={rippleColor} 
            isActive={isHovered || isPressed} 
            x={coords.x} 
            y={coords.y} 
            width={dims.width} 
            height={dims.height} 
         />
      </div>

      {/* Particles Reaction (Outside Clipping) */}
      {showBurst && !noBurst && <ParticleBurst />}

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