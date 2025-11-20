import React from 'react';
import { theme } from '../../Theme';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bordered?: boolean;
  style?: React.CSSProperties;
}

export const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', bordered = false, style }) => {
  const sizeMap = {
    sm: '36px',
    md: '48px',
    lg: '72px',
    xl: '100px',
  };

  const wrapperStyle: React.CSSProperties = {
    width: sizeMap[size],
    height: sizeMap[size],
    borderRadius: theme.radius.full,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface3,
    flexShrink: 0,
    padding: bordered ? '3px' : '0',
    background: bordered ? `linear-gradient(135deg, ${theme.colors.accent}, #FF0000)` : undefined,
    ...style,
  };

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: theme.radius.full,
    border: bordered ? `2px solid ${theme.colors.surface1}` : 'none',
    display: 'block',
  };

  return (
    <div style={wrapperStyle}>
      <img src={src} alt={alt} style={imgStyle} />
    </div>
  );
};