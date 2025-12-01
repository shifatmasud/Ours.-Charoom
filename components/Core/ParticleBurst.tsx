
import React from 'react';
import { motion } from 'framer-motion';
import { DS } from '../../Theme';

/**
 * ELI5 TLDR ENGINEERING SECRETS:
 * 
 * 1. GHOST MODE: `pointerEvents: 'none'` allows clicks to pass straight through to the parent button. 
 *    It's strictly visual fire-and-forget logic.
 * 
 * 2. AUTO-FILL: `inset: 0` + `absolute` ensures the burst origin is always the exact center 
 *    of the parent container (Parent MUST be `position: relative`).
 * 
 * 3. CHAOS MATH: `(Math.random() - 0.5) * 60` in the animate prop creates a unique, 
 *    organic explosion trajectory every single time it renders. No physics engine needed.
 * 
 * 4. OVERFLOW HACK: We strictly set `overflow: 'visible'` on the wrapper so particles 
 *    can fly outside the button boundaries without getting clipped.
 * 
 * 5. PERFORMANCE: Using `framer-motion` transforms (x, y, scale, opacity) targets 
 *    GPU composite layers, keeping the main thread free for logic.
 * 
 * USAGE:
 * <div style={{ position: 'relative' }}>
 *    {trigger && <ParticleBurst color="#FF0000" />}
 * </div>
 */

interface ParticleBurstProps {
  color?: string;
  count?: number;
}

export const ParticleBurst: React.FC<ParticleBurstProps> = ({ 
  color, 
  count = 6 
}) => {
  // Generate a lightweight array to map our particles
  const particles = Array.from({ length: count });

  return (
    <div style={{ 
      position: 'absolute', 
      inset: 0, 
      pointerEvents: 'none', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      overflow: 'visible', // Critical: Let particles escape the container
      zIndex: 10
    }}>
      {particles.map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ 
            // Explode outwards in random directions (~30px radius)
            x: (Math.random() - 0.5) * 60, 
            y: (Math.random() - 0.5) * 60, 
            opacity: 0, 
            scale: 0 
          }}
          transition={{ 
            duration: 0.5, 
            ease: "easeOut" 
          }}
          style={{
            position: 'absolute',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: color || DS.Color.Accent.Surface,
            // Add a subtle glow for extra polish
            boxShadow: `0 0 4px ${color || DS.Color.Accent.Surface}`
          }}
        />
      ))}
    </div>
  );
};
