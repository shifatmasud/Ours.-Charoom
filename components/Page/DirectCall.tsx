import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { theme, commonStyles } from '../../Theme';
import { api } from '../../services/supabaseClient';
import { CurrentUser } from '../../types';

export const DirectCall: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      try {
        const user = await api.getCurrentUser();
        if (mounted) {
          setCurrentUser(user);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
        if (mounted) setLoading(false);
      }
    };
    fetchUser();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div style={{ ...commonStyles.pageContainer, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.colors.text2 }}>Loading call...</p>
      </div>
    );
  }

  return (
    <motion.div 
      {...theme.motion.page}
      style={{ 
        ...commonStyles.pageContainer, 
        background: '#000', 
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <JitsiMeeting
        roomName={`TalkApp_${roomId || 'general'}`}
        configOverwrite={{
          startWithAudioMuted: false,
          disableModeratorIndicator: true,
          startScreenSharing: false,
          enableEmailInStats: false,
          prejoinPageEnabled: false,
        }}
        interfaceConfigOverwrite={{
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
        }}
        userInfo={{
          displayName: currentUser?.full_name || currentUser?.username || 'Guest',
        }}
        onApiReady={(externalApi) => {
          externalApi.addListener('videoConferenceLeft', () => {
            navigate(-1);
          });
        }}
        getIFrameRef={(iframeRef) => { 
          iframeRef.style.height = '100%'; 
          iframeRef.style.width = '100%'; 
          iframeRef.style.border = 'none';
        }}
      />
    </motion.div>
  );
};
