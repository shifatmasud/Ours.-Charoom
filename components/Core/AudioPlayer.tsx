
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SpeakerSimpleHigh, DotsThreeVertical } from '@phosphor-icons/react';
import { DS } from '../../Theme';

interface AudioPlayerProps {
  src: string;
  style?: React.CSSProperties;
}

const formatTime = (time: number) => {
  if (isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, style }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
        audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  // Determine progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#D4D4D8', // Zinc-300 for that specific light grey look in the image
        borderRadius: DS.Radius.Full,
        padding: '6px 12px', // Compact padding
        gap: '12px',
        width: '100%',
        minWidth: '220px',
        height: '44px',
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1)',
        color: '#18181B', // Zinc-900 for high contrast text
        ...style
    }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Play/Pause Toggle */}
      <button 
        onClick={togglePlay}
        style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            color: 'inherit',
            flexShrink: 0
        }}
      >
        {isPlaying ? <Pause weight="fill" size={14} /> : <Play weight="fill" size={14} />}
      </button>

      {/* Time Display */}
      <div style={{ 
          fontSize: '12px', 
          fontFamily: '"Inter", sans-serif', 
          fontWeight: 500, 
          fontVariantNumeric: 'tabular-nums', 
          flexShrink: 0,
          letterSpacing: '-0.02em'
      }}>
        {formatTime(currentTime)} / {formatTime(duration || 0)}
      </div>

      {/* Visual Scrubber / Waveform Placeholder */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative', height: '100%' }}>
         {/* Custom Range Input */}
         <input 
            type="range" 
            min={0} 
            max={duration || 100} 
            value={currentTime} 
            onClick={(e) => e.stopPropagation()}
            onChange={handleSeek}
            style={{
                width: '100%',
                height: '4px',
                borderRadius: '2px',
                background: `linear-gradient(to right, #18181B ${progress}%, rgba(24,24,27,0.1) ${progress}%)`,
                appearance: 'none',
                outline: 'none',
                cursor: 'pointer',
                margin: 0
            }} 
          />
          {/* Thumb Dot Visual (Purely decorative to match the image style if browser handles native thumb differently) */}
          <div style={{
              position: 'absolute',
              left: `${progress}%`,
              top: '50%',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#18181B',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }} />
      </div>

      {/* Volume Icon */}
      <SpeakerSimpleHigh size={16} weight="fill" color="#18181B" style={{ opacity: 0.8 }} />
      
      {/* Menu Icon */}
      <button 
        style={{ 
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, 
            color: 'inherit', display: 'flex', opacity: 0.8 
        }}
      >
          <DotsThreeVertical size={20} weight="bold" />
      </button>
    </div>
  );
};
