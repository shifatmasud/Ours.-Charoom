
import React from 'react';
import { motion } from 'framer-motion';
import { DS } from '../../Theme';

interface BrandedProgressBarProps {
  label?: string;
  subLabel?: string;
}

export const BrandedProgressBar: React.FC<BrandedProgressBarProps> = ({ 
    label = "LOADING", 
    subLabel = "ESTABLISHING CONNECTION" 
}) => {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      
      {/* Label Group */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <h2 style={{ 
            ...DS.Type.Expressive.Display, 
            fontSize: '56px', // Extra Bold & Large
            lineHeight: 0.85,
            color: DS.Color.Base.Content[1],
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '-1px'
        }}>
            {label}<span style={{ color: DS.Color.Accent.Surface }}>.</span>
        </h2>
        <motion.div 
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ 
                fontFamily: 'monospace', 
                fontSize: '11px', 
                color: DS.Color.Accent.Surface,
                fontWeight: 700,
                marginBottom: '6px',
                letterSpacing: '1px'
            }}
        >
            [{subLabel}]
        </motion.div>
      </div>

      {/* Progress Track */}
      <div style={{ 
          width: '100%', 
          height: '28px', // Thick and bold
          background: DS.Color.Base.Surface[2], 
          borderRadius: DS.Radius.S,
          border: `1px solid ${DS.Color.Base.Border}`,
          position: 'relative',
          overflow: 'hidden'
      }}>
          {/* Animated Bar */}
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: ['0%', '40%', '60%', '100%'] }}
            transition={{ 
                duration: 2.5, 
                times: [0, 0.3, 0.6, 1],
                ease: [0.22, 1, 0.36, 1], // Custom snappy easing
                repeat: Infinity,
                repeatDelay: 0.2
            }}
            style={{
                height: '100%',
                background: DS.Color.Accent.Surface,
                position: 'relative',
                borderRadius: DS.Radius.S,
            }}
          >
              {/* Gloss/Highlight for depth */}
              <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '40%',
                  background: 'rgba(255,255,255,0.15)'
              }} />
          </motion.div>

          {/* Technical Texture Overlay */}
          <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `repeating-linear-gradient(
                  -45deg,
                  transparent,
                  transparent 10px,
                  rgba(0,0,0,0.05) 10px,
                  rgba(0,0,0,0.05) 20px
              )`,
              pointerEvents: 'none'
          }} />
      </div>
    </div>
  );
};
