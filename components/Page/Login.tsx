
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '../../Theme';
import { api } from '../../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { User, Key, SignIn, WarningCircle, IdentificationCard, PaperPlaneRight, ArrowLeft } from '@phosphor-icons/react';
import { Button } from '../Core/Button';
import { Input } from '../Core/Input';
import { useAuth } from '../../contexts/AuthContext';

type AuthView = 'login' | 'register' | 'reset';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // State: 'login' | 'register' | 'reset'
  const [view, setView] = useState<AuthView>('login');
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleSwitchView = (newView: AuthView) => {
    setView(newView);
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
        if (view === 'register') {
            if (!fullName.trim()) throw new Error("Name is required");
            await api.signUpWithEmail(email, password, fullName);
            handleSwitchView('login');
            setSuccessMsg("Account created! Please log in.");
        } else if (view === 'reset') {
            if (!email.trim()) throw new Error("Email is required");
            await api.resetPassword(email);
            setSuccessMsg("Check your email for reset instructions.");
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

  // UI Text Logic
  const getHeadline = () => {
    switch(view) {
        case 'register': return "Join the void.";
        case 'reset': return "Recover access.";
        default: return "Enter the void.";
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
          key={view}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
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
            {getHeadline()}
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
           
           <AnimatePresence mode="popLayout">
             {view === 'register' && (
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
                    required={view === 'register'}
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

           <AnimatePresence mode="popLayout">
             {view !== 'reset' && (
                <motion.div
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: 'auto' }}
                   exit={{ opacity: 0, height: 0 }}
                   style={{ overflow: 'hidden' }}
                >
                    <Input 
                        type="password"
                        placeholder="Password" 
                        icon={<Key size={20} />}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={{ background: 'rgba(255,255,255,0.05)', marginBottom: '8px' }} // Added minimal margin
                        required={view !== 'reset'}
                    />
                    
                    {view === 'login' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                            <button
                                type="button"
                                onClick={() => handleSwitchView('reset')}
                                style={{
                                    background: 'none', border: 'none', 
                                    color: DS.Color.Base.Content[3], 
                                    fontSize: '12px', cursor: 'pointer',
                                    padding: '4px'
                                }}
                            >
                                Forgot Password?
                            </button>
                        </div>
                    )}
                </motion.div>
             )}
           </AnimatePresence>
           
           {/* Feedback Messages */}
           <AnimatePresence>
            {error && (
                <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ color: '#FFF', fontSize: '13px', background: 'rgba(220, 38, 38, 0.2)', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', border: `1px solid ${DS.Color.Status.Error}` }}
                >
                <WarningCircle size={20} weight="fill" flexShrink={0} color={DS.Color.Status.Error} />
                {error}
                </motion.div>
            )}
            {successMsg && (
                <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ color: '#FFF', fontSize: '13px', background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', border: `1px solid #22c55e` }}
                >
                <PaperPlaneRight size={20} weight="fill" flexShrink={0} color="#22c55e" />
                {successMsg}
                </motion.div>
            )}
           </AnimatePresence>

           <Button variant="primary" size="lg" type="submit" disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? 'Processing...' : (
                  <>
                     {view === 'reset' ? <PaperPlaneRight size={20} weight="fill" /> : <SignIn size={20} weight="fill" />}
                     {view === 'register' ? 'CREATE ACCOUNT' : view === 'reset' ? 'SEND INSTRUCTIONS' : 'LOG IN'}
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
            {view === 'reset' ? (
                 <button 
                 onClick={() => handleSwitchView('login')}
                 style={{ 
                   background: 'none', border: 'none', color: DS.Color.Base.Content[3], 
                   fontSize: '14px', cursor: 'pointer', textDecoration: 'none',
                   display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                   marginTop: '8px', transition: 'color 0.2s'
                 }}
               >
                 <ArrowLeft size={16} /> Back to Log In
               </button>
            ) : (
                <button 
                onClick={() => handleSwitchView(view === 'login' ? 'register' : 'login')}
                style={{ 
                  background: 'none', border: 'none', color: DS.Color.Base.Content[3], 
                  fontSize: '14px', cursor: 'pointer', textDecoration: 'none',
                  marginTop: '8px', transition: 'color 0.2s'
                }}
              >
                {view === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
              </button>
            )}
        </div>

      </div>
    </div>
  );
};
