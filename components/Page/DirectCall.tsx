import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { theme, commonStyles } from '../../Theme';
import { api } from '../../services/supabaseClient';
import { CurrentUser } from '../../types';

import { useAuth } from '../../contexts/AuthContext';

export const DirectCall: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [useJitsi, setUseJitsi] = useState(true);

  // Direction 1: Jitsi Meet (Managed UI, easiest)
  // Direction 2: Daily.co (Customizable SDK, high quality)
  // Direction 3: WebRTC + PeerJS (Full custom P2P control)

  if (!roomId) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ 
        ...commonStyles.pageContainer, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#000', 
        height: '100vh', 
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999
      }}
    >
      {useJitsi ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={roomId}
            configOverwrite={{
              startWithAudioMuted: true,
              disableModeratorIndicator: true,
              startScreenSharing: false,
              enableEmailInStats: false
            }}
            interfaceConfigOverwrite={{
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true
            }}
            userInfo={{
              displayName: currentUser?.full_name || 'User',
              email: ''
            }}
            onApiReady={(externalApi) => {
              // setup event listeners
              externalApi.addEventListener('videoConferenceLeft', () => {
                navigate(-1);
              });
            }}
            getIFrameRef={(iframeRef) => {
              iframeRef.style.height = '100%';
              iframeRef.style.width = '100%';
            }}
          />
          <button 
            onClick={() => navigate(-1)} 
            style={{ 
              position: 'absolute', 
              top: '20px', 
              left: '20px', 
              zIndex: 10000,
              padding: '8px 16px', 
              background: 'rgba(0,0,0,0.5)', 
              color: 'white', 
              border: '1px solid rgba(255,255,255,0.2)', 
              borderRadius: '8px', 
              cursor: 'pointer',
              backdropFilter: 'blur(10px)'
            }}
          >
            Exit Call
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: 'white' }}>
          <p>Redirecting to external call...</p>
          <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: theme.colors.surface2, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Go Back</button>
        </div>
      )}
    </motion.div>
  );
};
