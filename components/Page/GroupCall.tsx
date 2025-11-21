
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Microphone, MicrophoneSlash, PhoneDisconnect, Users } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, commonStyles } from '../../Theme';
import { api, supabase } from '../../services/supabaseClient';
import { CurrentUser } from '../../types';

// --- types ---
interface Peer {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  username?: string;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

export const GroupCall: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState('Initializing void...');

  // Refs for stability in callbacks
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, Peer>>({});
  const userRef = useRef<CurrentUser | null>(null);
  const channelRef = useRef<any>(null);

  // --- Audio Visualizer Helper ---
  // Simple random pulse for now to simulate activity, 
  // generic AudioContext analysis is heavy for code size in this constraint
  const [pulse, setPulse] = useState(1);
  useEffect(() => {
    const interval = setInterval(() => {
       setPulse(Math.random() * 0.5 + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // --- Cleanup ---
  const leaveCall = () => {
    // Stop tracks
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    
    // Close connections
    Object.values(peersRef.current).forEach((p: Peer) => p.connection.close());
    
    // Leave channel
    if (channelRef.current) supabase?.removeChannel(channelRef.current);
    
    navigate(-1);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const user = await api.getCurrentUser();
        setCurrentUser(user);
        userRef.current = user;

        // 1. Get Audio
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setStatus('Listening for signals...');

        if (!supabase) {
            setStatus('Error: Signaling server (Supabase) not configured.');
            return;
        }

        // 2. Join Signaling Channel
        const channel = supabase.channel(`call:${roomId}`, {
          config: {
            broadcast: { self: true } 
          }
        });
        channelRef.current = channel;

        // --- Signaling Event Handlers ---

        channel.on('broadcast', { event: 'join' }, ({ payload }: any) => {
            if (payload.userId === user.id) return;
            console.log('User joined:', payload.userId);
            // If someone joins, we (existing user) initiate the connection
            createPeer(payload.userId, true);
        });

        channel.on('broadcast', { event: 'signal' }, async ({ payload }: any) => {
            if (payload.to !== user.id) return; // Not for me
            
            const { from, type, data } = payload;
            
            if (type === 'offer') {
                const peer = createPeer(from, false);
                await peer.connection.setRemoteDescription(new RTCSessionDescription(data));
                const answer = await peer.connection.createAnswer();
                await peer.connection.setLocalDescription(answer);
                
                channel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { to: from, from: user.id, type: 'answer', data: answer }
                });
            } else if (type === 'answer') {
                const peer = peersRef.current[from];
                if (peer) {
                    await peer.connection.setRemoteDescription(new RTCSessionDescription(data));
                }
            } else if (type === 'candidate') {
                const peer = peersRef.current[from];
                if (peer) {
                    try {
                        await peer.connection.addIceCandidate(new RTCIceCandidate(data));
                    } catch (e) { console.error('Error adding candidate', e); }
                }
            }
        });

        channel.subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
               setStatus('Connected to void.');
               // Announce presence
               channel.send({
                   type: 'broadcast',
                   event: 'join',
                   payload: { userId: user.id }
               });
            }
        });

      } catch (e) {
        console.error(e);
        setStatus('Microphone access denied or error.');
      }
    };

    init();

    return () => {
      // Cleanup handled by leaveCall usually, but here for safety
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      if (channelRef.current) supabase?.removeChannel(channelRef.current);
    };
  }, [roomId]);

  // --- WebRTC Logic ---

  const createPeer = (targetId: string, initiator: boolean) => {
     if (peersRef.current[targetId]) return peersRef.current[targetId];

     const pc = new RTCPeerConnection(ICE_SERVERS);
     
     // Add local tracks
     localStreamRef.current?.getTracks().forEach(track => {
         pc.addTrack(track, localStreamRef.current!);
     });

     // Handle remote tracks
     pc.ontrack = (event) => {
         const stream = event.streams[0];
         setPeers(prev => ({
             ...prev,
             [targetId]: { ...prev[targetId], stream }
         }));
         
         // Auto-play audio
         const audio = document.createElement('audio');
         audio.srcObject = stream;
         audio.autoplay = true;
         // audio.controls = true; // Debug
         document.body.appendChild(audio); // Append to DOM (hidden) to ensure playback
     };

     // ICE Candidates
     pc.onicecandidate = (event) => {
         if (event.candidate && channelRef.current) {
             channelRef.current.send({
                 type: 'broadcast',
                 event: 'signal',
                 payload: { 
                     to: targetId, 
                     from: userRef.current?.id, 
                     type: 'candidate', 
                     data: event.candidate 
                 }
             });
         }
     };

     // Create Peer Object
     const newPeer: Peer = { id: targetId, connection: pc };
     peersRef.current[targetId] = newPeer;
     setPeers(prev => ({ ...prev, [targetId]: newPeer }));

     // Initiator Logic
     if (initiator) {
         (async () => {
             const offer = await pc.createOffer();
             await pc.setLocalDescription(offer);
             channelRef.current?.send({
                 type: 'broadcast',
                 event: 'signal',
                 payload: { 
                     to: targetId, 
                     from: userRef.current?.id, 
                     type: 'offer', 
                     data: offer 
                 }
             });
         })();
     }

     return newPeer;
  };

  const toggleMute = () => {
      if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => {
              track.enabled = !track.enabled;
          });
          setIsMuted(!localStreamRef.current.getAudioTracks()[0].enabled);
      }
  };

  return (
    <motion.div 
      {...theme.motion.page}
      style={{ 
        ...commonStyles.pageContainer, 
        background: '#000', // Deep void
        position: 'fixed', inset: 0, zIndex: 2000,
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden'
      }}
    >
        {/* Header */}
        <div style={{ padding: '32px', textAlign: 'center', zIndex: 10 }}>
            <h2 style={{ color: theme.colors.text2, fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Encrypted Channel
            </h2>
            <p style={{ color: theme.colors.text3, fontSize: '12px', marginTop: '8px' }}>{status}</p>
        </div>

        {/* Participants Grid */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', padding: '24px' }}>
            
            {/* Me */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <motion.div 
                   animate={{ 
                     boxShadow: !isMuted ? `0 0 ${20 * pulse}px ${theme.colors.accent}` : 'none',
                     scale: !isMuted ? [1, 1.05, 1] : 1
                   }}
                   transition={{ duration: 1.5, repeat: Infinity }}
                   style={{ borderRadius: '50%' }}
                >
                    {/* Replaced Avatar with Letter Fallback */}
                    <div style={{ 
                        width: '100px', 
                        height: '100px', 
                        borderRadius: '50%', 
                        background: theme.colors.surface3, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: `2px solid ${theme.colors.surface2}`,
                        color: theme.colors.text1,
                        fontSize: '36px',
                        fontWeight: 700,
                        fontFamily: theme.fonts.display,
                        letterSpacing: '2px'
                    }}>
                        {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                </motion.div>
                <span style={{ color: theme.colors.text1, fontSize: '14px', fontWeight: 500 }}>You</span>
            </div>

            {/* Remote Peers */}
            {Object.values(peers).map((peer: Peer) => (
                <motion.div 
                   key={peer.id}
                   initial={{ opacity: 0, scale: 0.5 }}
                   animate={{ opacity: 1, scale: 1 }}
                   style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
                >
                     <motion.div 
                        animate={{ 
                            boxShadow: `0 0 ${20 * (Math.random() * 0.5 + 0.5)}px rgba(255,255,255,0.3)`,
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ borderRadius: '50%' }}
                     >
                        {/* Using a generic avatar for peers since we didn't fetch their profiles in this specialized view to save bandwidth/complexity */}
                        <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: theme.colors.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            <Users size={48} color={theme.colors.text2} />
                        </div>
                     </motion.div>
                     <span style={{ color: theme.colors.text1, fontSize: '14px', fontWeight: 500 }}>User {peer.id.slice(0, 4)}</span>
                </motion.div>
            ))}

            {Object.keys(peers).length === 0 && (
                <div style={{ position: 'absolute', bottom: '180px', width: '100%', textAlign: 'center', color: theme.colors.text3, fontSize: '12px' }}>
                    Waiting for others to join...
                </div>
            )}
        </div>

        {/* Controls */}
        <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center', gap: '40px', background: 'linear-gradient(to top, #000 0%, transparent 100%)' }}>
            <motion.button
               whileTap={{ scale: 0.9 }}
               onClick={toggleMute}
               style={{
                   width: '64px', height: '64px', borderRadius: '50%',
                   background: isMuted ? theme.colors.text1 : 'rgba(255,255,255,0.1)',
                   color: isMuted ? '#000' : theme.colors.text1,
                   border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                   backdropFilter: 'blur(10px)', cursor: 'pointer'
               }}
            >
                {isMuted ? <MicrophoneSlash size={24} weight="fill" /> : <Microphone size={24} weight="fill" />}
            </motion.button>

            <motion.button
               whileTap={{ scale: 0.9 }}
               onClick={leaveCall}
               style={{
                   width: '64px', height: '64px', borderRadius: '50%',
                   background: theme.colors.danger,
                   color: '#fff',
                   border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                   boxShadow: '0 0 20px rgba(255, 51, 0, 0.4)', cursor: 'pointer'
               }}
            >
                <PhoneDisconnect size={28} weight="fill" />
            </motion.button>
        </div>
    </motion.div>
  );
};
