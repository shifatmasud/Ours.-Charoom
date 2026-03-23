
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { DS } from '../../Theme';

interface LightboxProps {
  isOpen: boolean;
  src: string;
  onClose: () => void;
  type?: 'image' | 'video';
  layoutId?: string;
  imgSize?: { w: number, h: number } | null;
}

export const Lightbox: React.FC<LightboxProps> = ({ isOpen, src, onClose, type = 'image', layoutId, imgSize }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: DS.Effect.Blur.Frosted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
          onClick={onClose}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              zIndex: 10000,
              backdropFilter: 'blur(10px)'
            }}
          >
            <X size={24} weight="bold" />
          </button>

          {type === 'video' ? (
             <motion.video 
               layout
               layoutId={layoutId}
               src={src} 
               controls 
               autoPlay 
               crossOrigin="anonymous"
               onClick={(e) => e.stopPropagation()}
               style={{ 
                 width: 'auto',
                 height: 'auto',
                 maxWidth: '100%', 
                 maxHeight: '90vh', 
                 aspectRatio: imgSize ? `${imgSize.w} / ${imgSize.h}` : undefined,
                 borderRadius: DS.Radius.M, 
                 objectFit: 'contain' 
               }} 
             />
          ) : (
             <motion.img 
               layout
               layoutId={layoutId}
               src={src} 
               alt="Full view" 
               crossOrigin="anonymous"
               onClick={(e) => e.stopPropagation()}
               style={{ 
                 width: 'auto',
                 height: 'auto',
                 maxWidth: '100%', 
                 maxHeight: '90vh', 
                 aspectRatio: imgSize ? `${imgSize.w} / ${imgSize.h}` : undefined,
                 objectFit: 'contain', 
                 borderRadius: DS.Radius.M 
               }} 
             />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};