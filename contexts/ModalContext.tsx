
import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS, theme } from '../Theme';
import { Button } from '../components/Core/Button';
import { WarningCircle, Question } from '@phosphor-icons/react';

interface ModalOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'alert' | 'confirm';
}

interface ModalContextType {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within a ModalProvider');
  return context;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<(ModalOptions & { resolve: (val: any) => void }) | null>(null);

  const showAlert = useCallback((message: string, title = 'Alert') => {
    return new Promise<void>((resolve) => {
      setModal({ message, title, type: 'alert', confirmLabel: 'OK', resolve });
    });
  }, []);

  const showConfirm = useCallback((message: string, title = 'Confirm') => {
    return new Promise<boolean>((resolve) => {
      setModal({ message, title, type: 'confirm', confirmLabel: 'Confirm', cancelLabel: 'Cancel', resolve });
    });
  }, []);

  const handleConfirm = () => {
    if (modal) {
      modal.resolve(true);
      setModal(null);
    }
  };

  const handleCancel = () => {
    if (modal) {
      modal.resolve(false);
      setModal(null);
    }
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AnimatePresence>
        {modal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={modal.type === 'alert' ? handleConfirm : undefined}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)',
                zIndex: 10000,
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
              animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
              style={{
                position: 'fixed',
                top: '40%',
                left: '50%',
                width: '90%',
                maxWidth: '400px',
                background: DS.Color.Base.Surface[2],
                borderRadius: DS.Radius.L,
                border: `1px solid ${DS.Color.Base.Border}`,
                padding: '24px',
                zIndex: 10001,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                textAlign: 'center',
              }}
            >
              <div style={{ 
                width: '48px', height: '48px', borderRadius: '50%', 
                background: modal.type === 'alert' ? 'rgba(255, 79, 31, 0.1)' : 'rgba(66, 133, 244, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                {modal.type === 'alert' ? (
                  <WarningCircle size={24} color={DS.Color.Accent.Surface} weight="fill" />
                ) : (
                  <Question size={24} color="#4285F4" weight="fill" />
                )}
              </div>

              <h3 style={{ ...DS.Type.Readable.Label, fontSize: '18px', marginBottom: '8px', color: theme.colors.text1 }}>
                {modal.title}
              </h3>
              <p style={{ ...DS.Type.Readable.Body, fontSize: '14px', color: theme.colors.text2, marginBottom: '24px' }}>
                {modal.message}
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {modal.type === 'confirm' && (
                  <Button variant="secondary" onClick={handleCancel} style={{ flex: 1 }}>
                    {modal.cancelLabel}
                  </Button>
                )}
                <Button variant="primary" onClick={handleConfirm} style={{ flex: 1 }}>
                  {modal.confirmLabel}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  );
};
