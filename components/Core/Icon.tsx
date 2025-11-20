import React from 'react';
import { IconProps } from '@phosphor-icons/react';

// Wrapper isn't strictly necessary but helps with consistency if we needed to swap libraries
export const IconWrapper: React.FC<{ icon: React.ComponentType<IconProps>, weight?: IconProps['weight'], className?: string, onClick?: () => void }> = ({ 
  icon: Icon, 
  weight = 'regular', 
  className, 
  onClick 
}) => {
  return (
    <button onClick={onClick} className={`transition-colors active:scale-90 ${className}`}>
      <Icon weight={weight} className="w-full h-full" />
    </button>
  );
};