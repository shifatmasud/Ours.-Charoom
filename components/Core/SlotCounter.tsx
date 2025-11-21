
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
  // Initialize prevValueRef to 0 if value is a number to ensure "count up" animation on mount
  const prevValueRef = useRef<string | number>(typeof value === 'number' ? 0 : value);
  const directionRef = useRef<number>(1);

  const currentStr = String(value);
  const prevStr = String(prevValueRef.current);

  const currentNum = parseFloat(currentStr.replace(/[^0-9.-]+/g, ''));
  const prevNum = parseFloat(prevStr.replace(/[^0-9.-]+/g, ''));

  if (!isNaN(currentNum) && !isNaN(prevNum) && currentNum !== prevNum) {
    directionRef.current = currentNum > prevNum ? 1 : -1;
  }

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  const columns = useMemo(() => {
    const currChars = currentStr.split('');
    const prevChars = prevStr.split('');
    const maxLen = Math.max(currChars.length, prevChars.length);
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
      <span style={{
        position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
        overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0
      }}>
        {value}
      </span>

      <div aria-hidden="true" style={{ display: 'flex' }}>
        {columns.map((char, index) => (
           <SlotColumn
             key={`col-${columns.length - 1 - index}`}
             char={char}
             direction={directionRef.current}
             index={index}
           />
        ))}
      </div>
    </div>
  );
};

const SlotColumn: React.FC<{ char: string | null, direction: number, index: number }> = ({ char, direction, index }) => {
  const displayChar = char === null ? '' : char;

  return (
    <div style={{
      position: 'relative',
      display: 'inline-flex',
      justifyContent: 'center',
      overflow: 'visible',
      minWidth: displayChar === ' ' ? '0.3em' : undefined,
      height: '1.2em'
    }}>
      {/* Invisible spacer */}
      <span style={{ opacity: 0, visibility: 'hidden' }}>{displayChar || '0'}</span>

      <AnimatePresence mode="popLayout" custom={direction}>
        <motion.span
          key={displayChar}
          custom={direction}
          variants={{
            initial: (dir) => ({
              y: dir > 0 ? '100%' : '-100%',
              opacity: 0,
              scale: 0.5,
              filter: 'blur(4px)'
            }),
            animate: {
              y: '0%',
              opacity: 1,
              scale: 1,
              filter: 'blur(0px)'
            },
            exit: (dir) => ({
              y: dir > 0 ? '-100%' : '100%',
              opacity: 0,
              scale: 0.5,
              filter: 'blur(4px)',
              position: 'absolute'
            })
          }}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{
            y: { type: "spring", stiffness: 150, damping: 18, mass: 1 },
            opacity: { duration: 0.2 },
            scale: { duration: 0.2 },
            filter: { duration: 0.2 },
            delay: index * 0.08, // Stagger effect
          }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            willChange: 'transform, filter, opacity'
          }}
        >
          {displayChar}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};
