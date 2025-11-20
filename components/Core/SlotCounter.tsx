import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SlotCounterProps {
  value: number | string;
  fontSize?: string;
  fontWeight?: number | string;
  color?: string;
  lineHeight?: number | string;
  letterSpacing?: string;
}

export const SlotCounter: React.FC<SlotCounterProps> = ({
  value,
  fontSize = '14px',
  fontWeight = 500,
  color = 'inherit',
  lineHeight = 1,
  letterSpacing = 'normal'
}) => {
  // Track history for direction
  const prevValueRef = useRef<string | number>(value);
  const directionRef = useRef<number>(1);

  const currentStr = String(value);
  const prevStr = String(prevValueRef.current);
  
  // Smart Direction Logic:
  // Try to parse as numbers to determine if the total value is increasing or decreasing.
  // This ensures that 9 -> 10 rolls UP (because 10 > 9), rather than mixed signals.
  const currentNum = parseFloat(currentStr.replace(/[^0-9.-]+/g, ''));
  const prevNum = parseFloat(prevStr.replace(/[^0-9.-]+/g, ''));

  if (!isNaN(currentNum) && !isNaN(prevNum) && currentNum !== prevNum) {
    directionRef.current = currentNum > prevNum ? 1 : -1;
  }

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  // Algorithm: Right-Align Diffing
  // We want to align the 'units' column, 'tens' column, etc. regardless of length changes.
  const columns = useMemo(() => {
    const currChars = currentStr.split('');
    const prevChars = prevStr.split('');
    
    const maxLen = Math.max(currChars.length, prevChars.length);
    
    // Pad the START of the array with nulls to align the ENDs (Units place)
    // 100 vs 99 -> [1, 0, 0] vs [null, 9, 9]
    const padded = Array(maxLen - currChars.length).fill(null).concat(currChars);
    return padded;
  }, [currentStr, prevStr]);

  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', 
      fontSize, fontWeight, color, lineHeight, letterSpacing,
      fontVariantNumeric: 'tabular-nums', 
      overflow: 'hidden', whiteSpace: 'pre',
      position: 'relative'
    }}>
      {/* Accessibility: Read full value, hide mechanical bits */}
      <span style={{ 
        position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, 
        overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 
      }}>
        {value}
      </span>

      <div aria-hidden="true" style={{ display: 'flex' }}>
        {columns.map((char, index) => (
           // Key based on power/position from right ensures stable identity during length changes
           <SlotColumn 
             key={`col-${columns.length - 1 - index}`}
             char={char}
             direction={directionRef.current}
           />
        ))}
      </div>
    </div>
  );
};

const SlotColumn: React.FC<{ char: string | null, direction: number }> = ({ char, direction }) => {
  const displayChar = char === null ? '' : char;
  
  return (
    <div style={{ 
      position: 'relative', 
      display: 'inline-flex', 
      justifyContent: 'center', 
      overflow: 'visible',
      minWidth: displayChar === ' ' ? '0.3em' : undefined // Handle space explicitly
    }}>
      {/* Invisible spacer for layout stability - defines width */}
      <span style={{ opacity: 0, visibility: 'hidden' }}>{displayChar}</span>
      
      {/* Absolute positioned animated character */}
      <AnimatePresence mode="popLayout" custom={direction}>
        <motion.span
          key={displayChar}
          custom={direction}
          variants={{
            initial: (dir) => ({ 
              y: dir > 0 ? '100%' : '-100%', 
              opacity: 0, 
              filter: 'blur(4px)',
              scale: 0.8 
            }),
            animate: { 
              y: '0%', 
              opacity: 1, 
              filter: 'blur(0px)',
              scale: 1 
            },
            exit: (dir) => ({ 
              y: dir > 0 ? '-100%' : '100%', 
              opacity: 0, 
              filter: 'blur(4px)',
              scale: 0.8,
              position: 'absolute' 
            })
          }}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ 
            y: { type: "spring", stiffness: 280, damping: 22, mass: 0.3 }, // Snappy mechanical feel
            opacity: { duration: 0.15 },
            filter: { duration: 0.15 }
          }}
          style={{ 
            position: 'absolute', 
            inset: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            willChange: 'transform, opacity, filter'
          }}
        >
          {displayChar}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};