
import React from 'react';
import { motion } from 'framer-motion';
import { DS } from '../../Theme';

interface LoaderProps {
  fullscreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const Loader: React.FC<LoaderProps> = ({ fullscreen = false, size = 'md', label }) => {
  const sizeMap = {
    sm: 24,
    md: 48,
    lg: 80
  };
  
  const px = sizeMap[size];
  const half = px / 2;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: fullscreen ? '100vw' : '100%',
    height: fullscreen ? '100vh' : '100%',
    background: fullscreen ? DS.Color.Base.Surface[1] : 'transparent',
    perspective: '800px', // Exaggerated perspective for toon look
    gap: '32px',
    position: fullscreen ? 'fixed' : 'relative',
    top: 0,
    left: 0,
    zIndex: fullscreen ? 9999 : 'auto',
  };

  const faceStyle: React.CSSProperties = {
    position: 'absolute',
    width: px,
    height: px,
    background: DS.Color.Accent.Surface, // Solid Brand Color
    border: '3px solid #000000', // Strict Black Outline (Toon Ink)
    opacity: 1, // Solid, no transparency
    boxShadow: 'none', // Glowless
    backfaceVisibility: 'hidden', // Clean faces
  };

  return (
    <div style={containerStyle}>
       <motion.div
         style={{
             width: px,
             height: px,
             position: 'relative',
             transformStyle: 'preserve-3d',
         }}
         animate={{
             rotateX: [0, 360],
             rotateY: [0, 360],
         }}
         transition={{
             duration: 3,
             ease: "linear",
             repeat: Infinity
         }}
       >
          {/* Front */}
          <div style={{ ...faceStyle, transform: `translateZ(${half}px)` }} />
          
          {/* Back */}
          <div style={{ ...faceStyle, transform: `rotateY(180deg) translateZ(${half}px)` }} />
          
          {/* Right */}
          <div style={{ ...faceStyle, transform: `rotateY(90deg) translateZ(${half}px)` }} />
          
          {/* Left */}
          <div style={{ ...faceStyle, transform: `rotateY(-90deg) translateZ(${half}px)` }} />
          
          {/* Top */}
          <div style={{ ...faceStyle, transform: `rotateX(90deg) translateZ(${half}px)` }} />
          
          {/* Bottom */}
          <div style={{ ...faceStyle, transform: `rotateX(-90deg) translateZ(${half}px)` }} />
          
       </motion.div>
       
       {label && (
           <motion.span
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.5 }}
             style={{
                 ...DS.Type.Expressive.Display,
                 fontSize: '18px',
                 letterSpacing: '0.1em',
                 color: DS.Color.Base.Content[1],
                 textTransform: 'uppercase',
                 textShadow: 'none' // Clean, no effects
             }}
           >
               {label}
           </motion.span>
       )}
    </div>
  );
};
