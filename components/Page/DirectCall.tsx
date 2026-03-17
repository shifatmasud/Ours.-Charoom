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

  useEffect(() => {
    // Redirect to Zoom meeting
    // Note: A real Zoom integration requires a backend to generate JWT signatures.
    // For now, we redirect to a generic Zoom join URL.
    window.location.href = `https://zoom.us/wc/join/${roomId?.replace(/[^0-9]/g, '').substring(0, 10) || '1234567890'}`;
  }, [roomId]);

  return (
    <div style={{ ...commonStyles.pageContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', height: '100vh', flexDirection: 'column', gap: '20px' }}>
      <p style={{ color: 'white' }}>Redirecting to Zoom...</p>
      <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: theme.colors.surface2, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Go Back</button>
    </div>
  );
};
