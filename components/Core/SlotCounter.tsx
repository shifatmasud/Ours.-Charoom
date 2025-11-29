
import React from 'react';
import { motion } from 'framer-motion';

const DIGIT_HEIGHT = '1em'; // Corresponds to the font size

interface DigitProps {
  digit: string;
}

const Digit: React.FC<DigitProps> = ({ digit }) => {
  const styles = {
    digitWrapper: {
      height: DIGIT_HEIGHT,
      lineHeight: 1, // Ensure tight bounding box for the scroll window
      overflow: 'hidden',
    },
    digitColumn: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    digit: {
      height: '1em',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }
  };

  const number = parseInt(digit);

  return (
    <div style={styles.digitWrapper}>
      <motion.div
        style={styles.digitColumn}
        animate={{ y: `-${number * 1}em` }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        {[...Array(10).keys()].map(i => (
          <span key={i} style={styles.digit}>{i}</span>
        ))}
      </motion.div>
    </div>
  );
};

interface SlotCounterProps {
  value: number | string;
  fontSize?: string;
  fontWeight?: number | string;
  color?: string;
  lineHeight?: number | string;
  letterSpacing?: string;
  useFormatting?: boolean;
}

export const SlotCounter: React.FC<SlotCounterProps> = ({
  value,
  fontSize,
  fontWeight,
  color,
  lineHeight = 1,
  letterSpacing = 'normal',
  useFormatting = true
}) => {
  let formattedValue = String(value);
  
  // Format number with commas if requested and valid
  if (useFormatting) {
      const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
      if (!isNaN(num)) {
          formattedValue = num.toLocaleString();
      }
  }

  const chars = formattedValue.split('');

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'row' as const,
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: lineHeight,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      fontVariantNumeric: 'tabular-nums',
    },
    char: {
      height: '1em',
      display: 'flex',
      alignItems: 'center',
    },
  };

  return (
    <div style={styles.container}>
      {chars.map((char, index) =>
        isNaN(parseInt(char)) ? (
          <span key={index} style={styles.char}>{char}</span>
        ) : (
          <Digit key={index} digit={char} />
        )
      )}
    </div>
  );
};
