
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DS } from '../../Theme';
import { api } from '../../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { GoogleLogo, User, Key, SignIn } from '@phosphor-icons/react';
import { Button } from '../Core/Button';
import { Input } from '../Core/Input';
import { useAuth } from '../../contexts/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await api.signInWithGoogle();
      await refreshAuth();
      navigate('/');
    } catch (error) {
      console.error("Login failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
        await api.signInWithPassword(userId, password);
        await refreshAuth();
        navigate('/');
    } catch (err: any) {
        setError(err.message || 'Access Denied');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      width: '100%', 
      background: '#000000', // Strict void
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      color: '#FFFFFF'
    }}>
      
      {/* Floating Particles Background Effect */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
         {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: Math.random() * window.innerHeight,
                opacity: 0.1,
                scale: Math.random() * 0.5 + 0.5
              }}
              animate={{ 
                y: [null, Math.random() * window.innerHeight],
                opacity: [0.1, 0.3, 0.1]
              }}
              transition={{ duration: 10 + Math.random() * 20, repeat: Infinity, ease: "linear" }}
              style={{
                position: 'absolute',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: DS.Color.Accent.Surface
              }}
            />
         ))}
      </div>

      <div style={{ maxWidth: '360px', padding: '24px', width: '100%', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ marginBottom: '48px' }}
        >
          <h1 style={{ 
            fontSize: '80px', 
            letterSpacing: '-2px',
            lineHeight: 0.9,
            fontFamily: DS.Type.Expressive.Display.fontFamily
          }}>
            OURS<span style={{ color: DS.Color.Accent.Surface }}>.</span>
          </h1>
          <p style={{ 
            color: DS.Color.Base.Content[3], 
            fontSize: '16px', 
            marginTop: '16px',
            fontFamily: DS.Type.Expressive.Quote.fontFamily
          }}>
            Enter the void.
          </p>
        </motion.div>

        <form onSubmit={handleDirectLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
           <Input 
              placeholder="User ID" 
              icon={<User size={20} />}
              value={userId}
              onChange={e => setUserId(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)' }}
           />
           <Input 
              type="password"
              placeholder="Password" 
              icon={<Key size={20} />}
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)' }}
           />
           
           {error && <p style={{ color: DS.Color.Status.Error, fontSize: '13px' }}>{error}</p>}

           <Button variant="primary" size="lg" type="submit" disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? 'Processing...' : (
                  <>
                     <SignIn size={20} weight="fill" />
                     LOG IN
                  </>
              )}
           </Button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0', opacity: 0.5 }}>
           <div style={{ height: '1px', flex: 1, background: DS.Color.Base.Border }}></div>
           <span style={{ fontSize: '12px', color: DS.Color.Base.Content[3] }}>OR</span>
           <div style={{ height: '1px', flex: 1, background: DS.Color.Base.Border }}></div>
        </div>

        <Button 
          variant="secondary" 
          size="lg" 
          onClick={handleGoogleLogin}
          style={{ 
            width: '100%', 
            background: 'transparent', 
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)' 
          }}
        >
          <GoogleLogo weight="bold" size={20} />
          Sign in with Google
        </Button>

      </div>
    </div>
  );
};
