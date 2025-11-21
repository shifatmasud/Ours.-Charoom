
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '../../Theme';
import { api } from '../../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { User, Key, SignIn, WarningCircle, IdentificationCard } from '@phosphor-icons/react';
import { Button } from '../Core/Button';
import { Input } from '../Core/Input';
import { useAuth } from '../../contexts/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
        if (isRegistering) {
            if (!fullName.trim()) throw new Error("Name is required");
            await api.signUpWithEmail(email, password, fullName);
            // If successful, usually we might need email confirmation depending on supabase settings
            // For now, try to auto-login or switch to login view
            setIsRegistering(false);
            setError("Account created! Please check email or log in.");
        } else {
            // Login (or Secret Guest)
            await api.signInWithPassword(email, password);
            await refreshAuth();
            navigate('/');
        }
    } catch (err: any) {
        console.error(err);
        setError(err.message || 'Authentication failed');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      width: '100%', 
      background: '#000000', 
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
            {isRegistering ? "Join the void." : "Enter the void."}
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
           
           <AnimatePresence>
             {isRegistering && (
               <motion.div
                 initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                 animate={{ opacity: 1, height: 'auto' }}
                 exit={{ opacity: 0, height: 0 }}
               >
                  <Input 
                    placeholder="Full Name" 
                    icon={<IdentificationCard size={20} />}
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                    required={isRegistering}
                  />
               </motion.div>
             )}
           </AnimatePresence>

           <Input 
              placeholder="Email / ID" 
              icon={<User size={20} />}
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)' }}
              required
           />
           <Input 
              type="password"
              placeholder="Password" 
              icon={<Key size={20} />}
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.05)' }}
              required
           />
           
           {error && (
             <motion.div 
               initial={{ opacity: 0, y: -10 }} 
               animate={{ opacity: 1, y: 0 }}
               style={{ color: '#FFF', fontSize: '13px', background: 'rgba(220, 38, 38, 0.2)', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', border: `1px solid ${DS.Color.Status.Error}` }}
             >
               <WarningCircle size={20} weight="fill" flexShrink={0} color={DS.Color.Status.Error} />
               {error}
             </motion.div>
           )}

           <Button variant="primary" size="lg" type="submit" disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? 'Processing...' : (
                  <>
                     <SignIn size={20} weight="fill" />
                     {isRegistering ? 'CREATE ACCOUNT' : 'LOG IN'}
                  </>
              )}
           </Button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0', opacity: 0.5 }}>
           <div style={{ height: '1px', flex: 1, background: DS.Color.Base.Border }}></div>
           <span style={{ fontSize: '12px', color: DS.Color.Base.Content[3] }}>OR</span>
           <div style={{ height: '1px', flex: 1, background: DS.Color.Base.Border }}></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              style={{ 
                background: 'none', border: 'none', color: DS.Color.Base.Content[3], 
                fontSize: '14px', cursor: 'pointer', textDecoration: 'none',
                marginTop: '8px', transition: 'color 0.2s'
              }}
            >
              {isRegistering ? "Already have an account? Log In" : "Don't have an account? Sign Up"}
            </button>
        </div>

      </div>
    </div>
  );
};
