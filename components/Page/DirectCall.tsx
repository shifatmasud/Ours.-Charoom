
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
    // A good set of public STUN servers.
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.global.max.com:3478' },
    { urls: 'stun:stun.mixvoip.com:3478' },
    { urls: 'stun:stun.nextcloud.com:443' },
    
    // --- PRODUCTION CRITICAL ---
    // The public TURN server below is for demonstration and may be unreliable. For a stable 
    // application, you MUST deploy your own TURN server (e.g., COTURN) or use a paid service.
    // We are adding `turns:` (TURN over TLS) which is more robust for traversing firewalls.
    {
      urls: [
        'turn:openrelay.metered.ca:80',          // TURN over UDP
        'turn:openrelay.metered.ca:443',         // TURN over UDP on 443
        'turns:openrelay.metered.ca:443',        // TURN over TCP/TLS (better for firewalls)
        'turns:openrelay.metered.ca:5349'        // Standard TURN/TLS port
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
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
    if (window.location.protocol !== 'https:' && !['localhost', '1227.0.0.1'].includes(window.location.hostname)) {
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

  const leaveCall = () => {
      if (channelRef.current && userRef.current) {
          channelRef.current.send({
              type: 'broadcast',
              event: 'leave',
              payload: { userId: userRef.current.id }
          });
      }
  
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach((p: Peer) => p.connection.close());
      peersRef.current = {};
      setPeers({});
      if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
      }
  };

  useEffect(() => {
    let mounted = true;

    const handleBeforeUnload = () => {
        leaveCall();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

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
            if (payload.userId !== user.id && user.id > payload.userId) {
                console.log(`[WebRTC] User ${payload.userId} joined. I am initiator.`);
                createPeer(payload.userId, true);
            }
        });

        channel.on('broadcast', { event: 'leave' }, ({ payload }: any) => {
            if (payload.userId !== userRef.current?.id) {
                setStatus('Peer has left the call.');
                leaveCall();
                setTimeout(() => navigate(-1), 2000);
            }
        });

        channel.on('broadcast', { event: 'signal' }, async ({ payload }: any) => {
            if (payload.to !== user.id) return;

            const { from, type, data } = payload;
            let peer = peersRef.current[from];

            if (!peer && type === 'offer') {
                console.log(`[WebRTC] Received offer from ${from}. Creating peer as non-initiator.`);
                peer = createPeer(from, false);
            }

            if (!peer) {
                console.warn(`[WebRTC] Received signal for unknown peer ${from}. Ignoring.`);
                return;
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
                await channel.send({
                    type: 'broadcast', event: 'join',
                    payload: { userId: user.id }
                });
                setStatus('Waiting for peer...');
            } else if (subStatus === 'TIMED_OUT' || subStatus === 'CHANNEL_ERROR') {
                setStatus('Error: Real-time connection failed.');
                setConnectionStatus('failed');
            }
        });

      } catch (e: any) {
        const errorMsg = e.name === 'NotAllowedError' ? 'Permissions denied.' : 'No media devices.';
        setStatus(`Error: ${errorMsg}`);
        setConnectionStatus('failed');
      }
    };

    init();

    return () => {
        mounted = false;
        window.removeEventListener('beforeunload', handleBeforeUnload);
        leaveCall();
    };
  }, [roomId]);

  const createPeer = (targetId: string, initiator: boolean): Peer => {
      if (peersRef.current[targetId]) return peersRef.current[targetId];
      if (Object.keys(peersRef.current).length > 0) {
          console.warn(`[WebRTC] Rejecting call from ${targetId}. A call is already in progress.`);
          return null;
      }
      
      console.log(`[WebRTC] Creating peer connection to ${targetId}. Initiator: ${initiator}`);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      localStreamRef.current?.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
      });

      pc.onnegotiationneeded = async () => {
          if (initiator) {
              try {
                  console.log('[WebRTC] onnegotiationneeded: creating offer...');
                  const offer = await pc.createOffer();
                  await pc.setLocalDescription(offer);
                  channelRef.current?.send({
                      type: 'broadcast', event: 'signal',
                      payload: { to: targetId, from: userRef.current?.id, type: 'offer', data: pc.localDescription }
                  });
              } catch (e) {
                  console.error('[WebRTC] onnegotiationneeded failed:', e);
              }
          }
      };

      pc.ontrack = (event) => {
          setPeers(prev => ({
              ...prev,
              [targetId]: { ...prev[targetId], stream: event.streams[0] }
          }));
      };

      pc.oniceconnectionstatechange = () => {
          console.log(`[WebRTC] ICE state for ${targetId}: ${pc.iceConnectionState}`);
          setConnectionStatus(pc.iceConnectionState);
          
          switch (pc.iceConnectionState) {
              case 'checking': setStatus('Establishing connection...'); break;
              case 'connected': case 'completed': setStatus('Media connected.'); break;
              case 'disconnected':
                  setStatus('Connection lost. Reconnecting...');
                  if (initiator && pc.restartIce) pc.restartIce();
                  break;
              case 'failed': setStatus('Connection failed. Your network may be blocking the connection.'); break;
              case 'closed': setStatus('Call ended.'); break;
          }
      };

      pc.onicecandidate = (event) => {
          if (event.candidate && channelRef.current) {
              channelRef.current.send({
                  type: 'broadcast', event: 'signal',
                  payload: { to: targetId, from: userRef.current?.id, type: 'candidate', data: event.candidate }
              });
          }
      };

// FIX: Explicitly type the `peer` object to ensure `connectionState` is correctly typed as `RTCIceConnectionState`, which resolves downstream type errors.
      const peer: Peer = { id: targetId, connection: pc, connectionState: 'new' };
      peersRef.current[targetId] = peer;
      setPeers(prev => ({ ...prev, [targetId]: peer }));
      return peer;
  };

  const toggleMute = () => {
      localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(prev => !prev);
  };

  const toggleVideo = () => {
      if (isScreenSharing) return;
      localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoEnabled(prev => !prev);
  };

  const toggleScreenShare = async () => {
    const replaceVideoTrack = (newTrack: MediaStreamTrack | null) => {
        const sender = Object.values(peersRef.current)[0]?.connection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(newTrack);
        
        if(localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(t => {
                t.stop();
                localStreamRef.current.removeTrack(t);
            });
            if (newTrack) localStreamRef.current.addTrack(newTrack);
        }
    };

    if (isScreenSharing) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const camTrack = stream.getVideoTracks()[0];
        replaceVideoTrack(camTrack);
        setIsScreenSharing(false);
        setIsVideoEnabled(true);
    } else {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = stream.getVideoTracks()[0];
        screenTrack.onended = () => { if (isScreenSharing) toggleScreenShare(); };
        replaceVideoTrack(screenTrack);
        setIsScreenSharing(true);
        setIsVideoEnabled(true);
    }
  };
  
  const isError = status.startsWith('Error:');
  const isFailed = connectionStatus === 'failed';
  const controlsDisabled = isError || isFailed;

  const getStatusIcon = () => {
      if (isError || isFailed) return <WifiSlash weight="fill" color={theme.colors.danger} />;
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
                background: isError || isFailed ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255,255,255,0.05)', 
                color: isError || isFailed ? theme.colors.danger : theme.colors.text3,
                border: `1px solid ${isError || isFailed ? theme.colors.danger : 'rgba(255,255,255,0.1)'}`,
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
            <ControlButton onClick={toggleMute} active={!isMuted} icon={isMuted ? MicrophoneSlash : Microphone} disabled={controlsDisabled} />
            <ControlButton onClick={toggleVideo} active={isVideoEnabled && !isScreenSharing} icon={isVideoEnabled && !isScreenSharing ? VideoCamera : VideoCameraSlash} disabled={controlsDisabled || isScreenSharing} />
            <ControlButton onClick={toggleScreenShare} active={isScreenSharing} icon={isScreenSharing ? Screencast : DesktopTower} disabled={controlsDisabled} />
            
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

    const showVideo = isVideoOn && (peer.connection?.iceConnectionState === 'connected' || peer.connection?.iceConnectionState === 'completed');

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
                           {peer.connection?.iceConnectionState === 'connected' ? 'Video Off' : 'Connecting...'}
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
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
            transition: 'background 0.2s, color 0.2s'
        }}
    >
        <Icon size={24} weight="fill" />
    </motion.button>
);
