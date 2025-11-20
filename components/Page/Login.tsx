import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { theme, commonStyles } from '../../Theme';
import { api } from '../../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { GoogleLogo } from '@phosphor-icons/react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await api.signInWithGoogle();
      navigate('/');
    } catch (error) {
      console.error("Login failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      ...commonStyles.pageContainer, 
      background: `radial-gradient(circle at 50% 100%, #1a0a0a, ${theme.colors.surface1})` 
    }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        width: '100%',
        padding: '24px',
        maxWidth: '400px'
      }}>
        
        <motion.div
          initial={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: '48px', textAlign: 'center' }}
        >
          <h1 style={{ 
            fontSize: '64px', 
            color: theme.colors.text1, 
            letterSpacing: '2px',
            marginBottom: '16px'
          }}>
            Ours<span style={{ color: theme.colors.accent }}>.</span>
          </h1>
          <p style={{ 
            color: theme.colors.text2, 
            fontSize: '16px', 
            fontFamily: theme.fonts.raw 
          }}>
            Welcome home.
          </p>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.98 }}
          onClick={handleLogin}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '16px 24px',
            borderRadius: theme.radius.full,
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text1,
            fontSize: '16px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            boxShadow: theme.shadow.soft,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {isLoading ? (
             <motion.div 
               animate={{ rotate: 360 }} 
               transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
               style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${theme.colors.text3}`, borderTopColor: theme.colors.text1 }} 
             />
          ) : (
             <>
               <GoogleLogo weight="bold" size={20} />
               <span>Continue with Google</span>
             </>
          )}
        </motion.button>

        <div style={{ marginTop: '32px', fontSize: '12px', color: theme.colors.text3, textAlign: 'center', lineHeight: 1.5 }}>
          By entering, you agree to remain chill <br/> and respect the void.
        </div>

      </div>
    </div>
  );
};