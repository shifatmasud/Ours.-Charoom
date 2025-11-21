
import React from 'react';
import { DS } from '../../Theme';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bordered?: boolean;
  style?: React.CSSProperties;
}

export const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', bordered = false, style }) => {
  const sizeMap = {
    sm: '32px',
    md: '48px',
    lg: '72px',
    xl: '100px',
  };

  const wrapperStyle: React.CSSProperties = {
    width: sizeMap[size],
    height: sizeMap[size],
    borderRadius: DS.Radius.Full,
    overflow: 'hidden',
    backgroundColor: DS.Color.Base.Surface[3],
    flexShrink: 0,
    padding: bordered ? '3px' : '0',
    background: bordered ? `linear-gradient(135deg, ${DS.Color.Accent.Surface}, #FF0000)` : undefined,
    ...style,
  };

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: DS.Radius.Full,
    border: bordered ? `2px solid ${DS.Color.Base.Surface[1]}` : 'none',
    display: 'block',
  };

  return (
    <div style={wrapperStyle}>
      <img src={src} alt={alt} style={imgStyle} />
    </div>
  );
};
