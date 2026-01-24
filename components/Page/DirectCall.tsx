
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Microphone, MicrophoneSlash, PhoneDisconnect, VideoCamera, VideoCameraSlash, DesktopTower, Screencast, Users, ArrowsOut, WarningCircle, WifiHigh, WifiSlash } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, commonStyles } from '../../Theme';
import { api, supabase } from '../../services/supabaseClient';
import { CurrentUser } from '../../types';

interface Peer {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  connectionState?: RTCIceConnectionState;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // --- PRODUCTION CRITICAL ---
    // Without a TURN server, connections will fail on restrictive networks (e.g., mobile, corporate).
    // A TURN server acts as a relay when a direct peer-to-peer connection is impossible.
    // Replace with your own TURN server credentials from a service like Twilio or Xirsys.
    // {
    //   urls: 'turn:your-turn-server.com:3478?transport=tcp',
    //   username: 'your-username',
    //   credential: 'your-password'
    // }
  ]
};

export const DirectCall: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false); 
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [fullScreenPeerId, setFullScreenPeerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<RTCIceConnectionState>('new');

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, Peer>>({});
  const userRef = useRef<CurrentUser | null>(null);
  const channelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Pre-flight security and compatibility check
    if (window.location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        setStatus('Error: Secure connection (HTTPS) required.');
        setConnectionStatus('failed');
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('Error: Media devices API not supported.');
        setConnectionStatus('failed');
        return;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mounted || status.startsWith('Error:')) return;

      try {
        const user = await api.getCurrentUser();
        if(!mounted) return;
        setCurrentUser(user);
        userRef.current = user;

        setStatus('Requesting permissions...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        
        if (!mounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        stream.getVideoTracks().forEach(t => t.enabled = false);
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
             localVideoRef.current.srcObject = stream;
             localVideoRef.current.muted = true;
        }

        setStatus('Joining channel...');

        const channel = supabase.channel(`call:${roomId}`, {
          config: { broadcast: { self: true } }
        });
        channelRef.current = channel;

        channel.on('broadcast', { event: 'join' }, ({ payload }: any) => {
            if (payload.userId !== user.id) {
                console.log(`User ${payload.userId} joined, initiating call...`);
                createPeer(payload.userId, true);
            }
        });

        channel.on('broadcast', { event: 'signal' }, async ({ payload }: any) => {
            if (payload.to !== user.id) return;

            const { from, type, data } = payload;
            let peer = peersRef.current[from];

            if (!peer) {
                const newPeer = createPeer(from, false);
                if (!newPeer) return; // Peer creation failed (call is busy)
                peer = newPeer;
            }

            try {
                if (type === 'offer') {
                    await peer.connection.setRemoteDescription(new RTCSessionDescription(data));
                    const answer = await peer.connection.createAnswer();
                    await peer.connection.setLocalDescription(answer);
                    channel.send({
                        type: 'broadcast', event: 'signal',
                        payload: { to: from, from: user.id, type: 'answer', data: answer }
                    });
                } else if (type === 'answer') {
                    await peer.connection.setRemoteDescription(new RTCSessionDescription(data));
                } else if (type === 'candidate') {
                    await peer.connection.addIceCandidate(new RTCIceCandidate(data));
                }
            } catch (e) { console.error("Signaling error", e); }
        });

        channel.subscribe(async (subStatus: string) => {
            if (subStatus === 'SUBSCRIBED') {
                setStatus('Broadcasting presence...');
                const broadcastStatus = await channel.send({
                    type: 'broadcast', event: 'join',
                    payload: { userId: user.id }
                });

                if (broadcastStatus === 'ok') {
                    setStatus('Waiting for peer...');
                } else {
                    console.error('Broadcast failed with status:', broadcastStatus);
                    setStatus('Error: Connection failed.');
                    setConnectionStatus('failed');
                }
            } else if (subStatus === 'TIMED_OUT' || subStatus === 'CHANNEL_ERROR') {
                console.error('Supabase channel subscription failed:', subStatus);
                setStatus('Error: Real-time connection failed.');
                setConnectionStatus('failed');
            }
        });

      } catch (e: any) {
        console.error(e);
        const errorMsg = e.name === 'NotAllowedError' ? 'Permissions denied.' : 'No media devices.';
        setStatus(`Error: ${errorMsg}`);
        setConnectionStatus('failed');
      }
    };

    init();

    return () => {
        mounted = false;
        leaveCall();
    };
  }, [roomId]);

  const createPeer = (targetId: string, initiator: boolean): Peer | null => {
      // Enforce 1-on-1 call by rejecting new connections if one already exists.
      const existingPeers = Object.keys(peersRef.current);
      if (existingPeers.length > 0 && !peersRef.current[targetId]) {
          console.warn(`[DirectCall] Rejecting incoming connection from ${targetId}. A call is already in progress with ${existingPeers[0]}.`);
          return null; // Return null to indicate failure.
      }

      if (peersRef.current[targetId]) return peersRef.current[targetId];

      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      localStreamRef.current?.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
      });

      pc.ontrack = (event) => {
          console.log(`Received media stream from ${targetId}`);
          setPeers(prev => ({
              ...prev,
              [targetId]: { ...prev[targetId], stream: event.streams[0] }
          }));
      };

      pc.oniceconnectionstatechange = () => {
          console.log(`ICE state for ${targetId}: ${pc.iceConnectionState}`);
          setConnectionStatus(pc.iceConnectionState); // Update global status for UI
          
          if (pc.iceConnectionState === 'connected') {
            setStatus('Media connected.');
          }
          if (pc.iceConnectionState === 'failed') {
            setStatus('Connection failed. Network may be too restrictive.');
          }

          setPeers(prev => {
              if (prev[targetId]) {
                  return { ...prev, [targetId]: { ...prev[targetId], connectionState: pc.iceConnectionState }};
              }
              return prev;
          });
      };

      pc.onicecandidate = (event) => {
          if (event.candidate && channelRef.current) {
              channelRef.current.send({
                  type: 'broadcast', event: 'signal',
                  payload: { to: targetId, from: userRef.current?.id, type: 'candidate', data: event.candidate }
              });
          }
      };

      const peer: Peer = { id: targetId, connection: pc, connectionState: 'new' };
      peersRef.current[targetId] = peer;
      setPeers(prev => ({ ...prev, [targetId]: peer }));

      if (initiator) {
          pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
                channelRef.current?.send({
                    type: 'broadcast', event: 'signal',
                    payload: { to: targetId, from: userRef.current?.id, type: 'offer', data: pc.localDescription }
                });
            })
            .catch(e => console.error("Offer creation failed", e));
      }

      return peer;
  };

  const leaveCall = () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach((p: Peer) => p.connection.close());
      peersRef.current = {};
      if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
      }
  };

  const toggleMute = () => {
      if (localStreamRef.current) {
          const track = localStreamRef.current.getAudioTracks()[0];
          if (track) {
              track.enabled = !track.enabled;
              setIsMuted(!track.enabled);
          }
      }
  };

  const toggleVideo = () => {
      if (localStreamRef.current) {
          const track = localStreamRef.current.getVideoTracks()[0];
          if (track) {
              track.enabled = !track.enabled;
              setIsVideoEnabled(track.enabled);
              if (isScreenSharing && track.enabled) setIsScreenSharing(false);
          }
      }
  };

  const toggleScreenShare = async () => {
    const replaceVideoTrack = (newTrack: MediaStreamTrack) => {
        if (localStreamRef.current) {
            const oldTrack = localStreamRef.current.getVideoTracks()[0];
            if (oldTrack) {
                oldTrack.stop();
                localStreamRef.current.removeTrack(oldTrack);
            }
            localStreamRef.current.addTrack(newTrack);
            // Fix: Explicitly type the 'p' parameter to 'Peer' to fix type inference from Object.values.
            Object.values(peersRef.current).forEach((p: Peer) => {
                const sender = p.connection.getSenders().find(s => s.track?.kind === 'video');
                sender?.replaceTrack(newTrack);
            });
        }
    };

    if (isScreenSharing) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newTrack = stream.getVideoTracks()[0];
            replaceVideoTrack(newTrack);
            setIsScreenSharing(false);
        } catch (e) { console.error("Cam failed", e); }
    } else {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const newTrack = stream.getVideoTracks()[0];
            newTrack.onended = () => toggleScreenShare();
            replaceVideoTrack(newTrack);
            setIsScreenSharing(true);
            setIsVideoEnabled(true);
        } catch (e) { console.error("Screen share failed", e); }
    }
  };
  
  const isError = status.startsWith('Error:');

  const getStatusIcon = () => {
      if (isError || connectionStatus === 'failed') return <WifiSlash weight="fill" color={theme.colors.danger} />;
      if (connectionStatus === 'connected' || connectionStatus === 'completed') return <WifiHigh weight="fill" color="#22c55e" />;
      return <WarningCircle weight="fill" />;
  };

  return (
    <motion.div 
      {...theme.motion.page}
      style={{ 
        ...commonStyles.pageContainer, background: '#000', 
        position: 'fixed', inset: 0, zIndex: 2000,
        flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden'
      }}
    >
        <AnimatePresence>
            {fullScreenPeerId && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ position: 'absolute', inset: 0, zIndex: 3000, background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setFullScreenPeerId(null)}
                >
                    {fullScreenPeerId === 'local' ? (
                        <video 
                            ref={(el) => { if(el && localStreamRef.current) el.srcObject = localStreamRef.current; }}
                            autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                        />
                    ) : (
                         peers[fullScreenPeerId] && <FullScreenVideo peer={peers[fullScreenPeerId]} />
                    )}
                    <button style={{ position: 'absolute', top: 24, right: 24, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', border: 'none', color: 'white', padding: '12px' }}>
                        <ArrowsOut size={24} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>

        <div style={{ padding: '32px', textAlign: 'center', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
            <div style={{ 
                background: isError ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255,255,255,0.05)', 
                color: isError ? theme.colors.danger : theme.colors.text3,
                border: `1px solid ${isError ? theme.colors.danger : 'rgba(255,255,255,0.1)'}`,
                padding: '8px 16px', borderRadius: theme.radius.full,
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '12px', backdropFilter: 'blur(10px)',
            }}>
                {getStatusIcon()}
                {status} <span style={{ opacity: 0.5 }}>({connectionStatus})</span>
            </div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', padding: '24px', overflowY: 'auto' }}>
            <div 
                onClick={() => (isVideoEnabled || isScreenSharing) && setFullScreenPeerId('local')}
                style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: (isVideoEnabled || isScreenSharing) ? 'pointer' : 'default' }}
            >
                <div style={{ 
                    width: isVideoEnabled || isScreenSharing ? '240px' : '100px', 
                    height: isVideoEnabled || isScreenSharing ? '180px' : '100px', 
                    borderRadius: isVideoEnabled || isScreenSharing ? '16px' : '50%', 
                    background: theme.colors.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${theme.colors.surface2}`, overflow: 'hidden',
                    transition: 'all 0.3s ease'
                }}>
                    <video 
                        ref={localVideoRef} autoPlay muted playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: isVideoEnabled || isScreenSharing ? 'block' : 'none' }} 
                    />
                    {(!isVideoEnabled && !isScreenSharing) && (
                         <div style={{ fontSize: '36px', fontWeight: 700, color: theme.colors.text1 }}>
                             {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                         </div>
                    )}
                </div>
                <span style={{ color: theme.colors.text1, fontSize: '14px', fontWeight: 500 }}>You</span>
            </div>

            {Object.values(peers).map((peer: Peer) => (
                <RemotePeer key={peer.id} peer={peer} onMaximize={() => setFullScreenPeerId(peer.id)} />
            ))}
        </div>

        <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center', gap: '24px', background: 'linear-gradient(to top, #000 0%, transparent 100%)' }}>
            <ControlButton onClick={toggleMute} active={!isMuted} icon={isMuted ? MicrophoneSlash : Microphone} disabled={isError} />
            <ControlButton onClick={toggleVideo} active={isVideoEnabled && !isScreenSharing} icon={isVideoEnabled && !isScreenSharing ? VideoCamera : VideoCameraSlash} disabled={isError} />
            <ControlButton onClick={toggleScreenShare} active={isScreenSharing} icon={isScreenSharing ? Screencast : DesktopTower} disabled={isError} />
            
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { leaveCall(); navigate(-1); }}
               style={{
                   width: '64px', height: '64px', borderRadius: '50%',
                   background: theme.colors.danger, color: '#fff',
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

const RemotePeer: React.FC<{ peer: Peer, onMaximize: () => void }> = ({ peer, onMaximize }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hasStream = !!peer.stream && peer.stream.getTracks().length > 0;
    const isVideoOn = hasStream && !!peer.stream.getVideoTracks().find(t => t.enabled && !t.muted);

    useEffect(() => {
        if (hasStream && videoRef.current) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream, hasStream]);

    const showVideo = isVideoOn && peer.connectionState === 'connected';

    return (
        <motion.div 
           initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
           onClick={() => showVideo && onMaximize()}
           style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: showVideo ? 'pointer' : 'default' }}
        >
             <div style={{ 
                width: showVideo ? '240px' : '100px', height: showVideo ? '180px' : '100px', 
                borderRadius: showVideo ? '16px' : '50%', 
                background: theme.colors.surface3, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                overflow: 'hidden', border: `2px solid ${theme.colors.border}`,
                transition: 'all 0.3s ease'
             }}>
                 <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: showVideo ? 'block' : 'none' }} autoPlay playsInline />
                 {!showVideo && (
                     <div style={{ textAlign: 'center', color: theme.colors.text2 }}>
                        <Users size={32} />
                        <div style={{ fontSize: '10px', marginTop: '4px', textTransform: 'uppercase' }}>
                           {peer.connectionState === 'connected' ? 'Video Off' : 'Connecting...'}
                        </div>
                     </div>
                 )}
             </div>
             <span style={{ color: theme.colors.text1, fontSize: '14px', fontWeight: 500 }}>User {peer.id.slice(0, 4)}</span>
        </motion.div>
    );
};

const FullScreenVideo: React.FC<{ peer: Peer }> = ({ peer }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if(videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer]);
    return <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} autoPlay playsInline />;
};

const ControlButton = ({ onClick, active, icon: Icon, disabled }: any) => (
    <motion.button
        whileTap={{ scale: 0.9 }} onClick={onClick} disabled={disabled}
        style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: active ? theme.colors.text1 : 'rgba(255,255,255,0.1)',
            color: active ? '#000' : theme.colors.text1,
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)', 
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1
        }}
    >
        <Icon size={24} weight="fill" />
    </motion.button>
);