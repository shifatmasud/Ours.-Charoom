
import React, { useState } from 'react';
import { DS } from '../../Theme';
import { motion } from 'framer-motion';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ icon, style, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    background: DS.Color.Base.Surface[2],
    border: `1px solid ${isFocused ? DS.Color.Accent.Surface : DS.Color.Base.Border}`,
    borderRadius: DS.Radius.Full, // Rounded container as requested
    padding: '4px 16px',
    transition: 'all 0.2s ease',
    boxShadow: isFocused ? `0 0 0 2px rgba(255, 79, 31, 0.2)` : 'none',
    ...style
  };

  return (
    <motion.div 
      style={wrapperStyle}
      animate={{ scale: isFocused ? 1.01 : 1 }}
      transition={DS.Motion.Spring.Snappy}
    >
      {icon && (
        <div style={{ 
          marginRight: '12px', 
          color: isFocused ? DS.Color.Accent.Surface : DS.Color.Base.Content[3], // Accented icon on interaction
          display: 'flex',
          transition: 'color 0.2s ease'
        }}>
          {icon}
        </div>
      )}
      <input 
        {...props}
        onFocus={(e) => { setIsFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setIsFocused(false); props.onBlur?.(e); }}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '12px 0',
          color: DS.Color.Base.Content[1],
          ...DS.Type.Readable.Body,
        }}
      />
    </motion.div>
  );
};
