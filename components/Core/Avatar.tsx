
import React, { useState } from 'react';
import { DS } from '../../Theme';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bordered?: boolean;
  style?: React.CSSProperties;
}

export const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', bordered = false, style }) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: DS.Radius.Full,
    border: bordered ? `2px solid ${DS.Color.Base.Surface[1]}` : 'none',
    display: hasError ? 'none' : 'block',
  };

  const handleError = () => {
    if (!hasError) {
       setHasError(true);
       // Fallback to a generative colored placeholder
    }
  };

  return (
    <div style={wrapperStyle}>
      {!hasError ? (
        <img 
          src={imgSrc} 
          alt={alt} 
          style={imgStyle} 
          onError={handleError}
          crossOrigin="anonymous"
          loading="lazy"
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: DS.Color.Base.Surface[2], display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.Color.Base.Content[2], fontSize: size === 'sm' ? '10px' : '14px', fontWeight: 600 }}>
            {alt.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
};