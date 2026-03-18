
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
}

export const Lightbox: React.FC<LightboxProps> = ({ isOpen, src, onClose, type = 'image', layoutId }) => {
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
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(10px)',
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
              zIndex: 10000
            }}
          >
            <X size={24} weight="bold" />
          </button>

          <div
            style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            {type === 'video' ? (
               <motion.video 
                 layoutId={layoutId}
                 src={src} 
                 controls 
                 autoPlay 
                 style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: DS.Radius.M }} 
               />
            ) : (
               <motion.img 
                 layoutId={layoutId}
                 src={src} 
                 alt="Full view" 
                 style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: DS.Radius.M }} 
               />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
