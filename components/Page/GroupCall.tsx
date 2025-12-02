
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Microphone, MicrophoneSlash, PhoneDisconnect, VideoCamera, VideoCameraSlash, DesktopTower, Screencast, Users, ArrowsOut } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, commonStyles } from '../../Theme';
import { api, supabase } from '../../services/supabaseClient';
import { CurrentUser } from '../../types';

interface Peer {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
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
  const [isVideoEnabled, setIsVideoEnabled] = useState(false); 
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [fullScreenPeerId, setFullScreenPeerId] = useState<string | null>(null);

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, Peer>>({});
  const userRef = useRef<CurrentUser | null>(null);
  const channelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const user = await api.getCurrentUser();
        if(!mounted) return;
        setCurrentUser(user);
        userRef.current = user;

        // 1. Get User Media
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        
        // Mute video initially (soft mute)
        stream.getVideoTracks().forEach(t => t.enabled = false);
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
             localVideoRef.current.srcObject = stream;
             localVideoRef.current.muted = true;
        }

        setStatus('Connected.');

        // 2. Signaling
        const channel = supabase.channel(`call:${roomId}`, {
          config: { broadcast: { self: true } }
        });
        channelRef.current = channel;

        // JOIN: When someone joins, we initiate the call to them
        channel.on('broadcast', { event: 'join' }, ({ payload }: any) => {
            if (payload.userId !== user.id) {
                console.log(`User ${payload.userId} joined, initiating...`);
                createPeer(payload.userId, true);
            }
        });

        // SIGNAL: Exchange offers, answers, candidates
        channel.on('broadcast', { event: 'signal' }, async ({ payload }: any) => {
            if (payload.to !== user.id) return;

            const { from, type, data } = payload;
            let peer = peersRef.current[from];

            if (!peer) {
                // If we receive an offer from someone we don't know yet, create peer (passive)
                peer = createPeer(from, false);
            }

            try {
                if (type === 'offer') {
                    // Collision handling: strict initiator check is managed by logic above, 
                    // but we ensure we are in stable state or roll back.
                    if (peer.connection.signalingState !== 'stable') {
                        await Promise.all([
                            peer.connection.setLocalDescription({ type: 'rollback' }),
                            peer.connection.setRemoteDescription(new RTCSessionDescription(data))
                        ]);
                    } else {
                        await peer.connection.setRemoteDescription(new RTCSessionDescription(data));
                    }
                    
                    const answer = await peer.connection.createAnswer();
                    await peer.connection.setLocalDescription(answer);
                    channel.send({
                        type: 'broadcast',
                        event: 'signal',
                        payload: { to: from, from: user.id, type: 'answer', data: answer }
                    });
                } else if (type === 'answer') {
                    if (peer.connection.signalingState === 'have-local-offer') {
                         await peer.connection.setRemoteDescription(new RTCSessionDescription(data));
                    }
                } else if (type === 'candidate') {
                    try {
                        await peer.connection.addIceCandidate(new RTCIceCandidate(data));
                    } catch (e) {
                        console.error("Error adding ice candidate", e);
                    }
                }
            } catch (e) {
                console.error("Signaling error", e);
            }
        });

        channel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
                // Announce existence so others can connect to me
                channel.send({
                    type: 'broadcast',
                    event: 'join',
                    payload: { userId: user.id }
                });
            }
        });

      } catch (e) {
        console.error(e);
        setStatus('Media access denied or connection failed.');
      }
    };

    init();

    return () => {
        mounted = false;
        leaveCall();
    };
  }, [roomId]);

  const createPeer = (targetId: string, initiator: boolean) => {
      // Prevent duplicate peer creation
      if (peersRef.current[targetId]) return peersRef.current[targetId];

      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      // Add local tracks
      if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
              pc.addTrack(track, localStreamRef.current!);
          });
      }

      // Handle Remote Stream
      pc.ontrack = (event) => {
          console.log(`Received track from ${targetId}`, event.streams[0]);
          setPeers(prev => ({
              ...prev,
              [targetId]: { ...prev[targetId], id: targetId, connection: pc, stream: event.streams[0] }
          }));
      };

      // Connection State Monitoring
      pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
              console.log(`ICE ${pc.iceConnectionState}, attempting restart...`);
              if (initiator) {
                  pc.restartIce();
              }
          }
      };

      // ICE Candidates
      pc.onicecandidate = (event) => {
          if (event.candidate && channelRef.current) {
              channelRef.current.send({
                  type: 'broadcast',
                  event: 'signal',
                  payload: { to: targetId, from: userRef.current?.id, type: 'candidate', data: event.candidate }
              });
          }
      };

      const peer = { id: targetId, connection: pc };
      peersRef.current[targetId] = peer;
      setPeers(prev => ({ ...prev, [targetId]: peer }));

      if (initiator) {
          const makeOffer = async () => {
              try {
                  const offer = await pc.createOffer();
                  await pc.setLocalDescription(offer);
                  channelRef.current?.send({
                      type: 'broadcast',
                      event: 'signal',
                      payload: { to: targetId, from: userRef.current?.id, type: 'offer', data: offer }
                  });
              } catch(e) { console.error("Offer creation failed", e); }
          };
          makeOffer();
      }

      return peer;
  };

  const leaveCall = () => {
      if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      Object.values(peersRef.current).forEach((p: Peer) => p.connection.close());
      peersRef.current = {};
      
      if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
      }
  };

  // --- Controls ---

  const toggleMute = () => {
      if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
              audioTrack.enabled = !audioTrack.enabled;
              setIsMuted(!audioTrack.enabled);
          }
      }
  };

  const toggleVideo = () => {
      if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
              videoTrack.enabled = !videoTrack.enabled;
              setIsVideoEnabled(videoTrack.enabled);
              if (isScreenSharing && videoTrack.enabled) {
                   setIsScreenSharing(false);
              }
          }
      }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
        try {
            const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const camTrack = camStream.getVideoTracks()[0];
            
            if (localStreamRef.current) {
                const oldTrack = localStreamRef.current.getVideoTracks()[0];
                if (oldTrack) {
                    oldTrack.stop();
                    localStreamRef.current.removeTrack(oldTrack);
                }
                localStreamRef.current.addTrack(camTrack);
                camTrack.enabled = isVideoEnabled; 
                
                Object.values(peersRef.current).forEach((p: Peer) => {
                    const sender = p.connection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(camTrack);
                });
            }
            setIsScreenSharing(false);
        } catch (e) { 
            console.error("Revert to cam failed", e); 
        }

    } else {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            
            screenTrack.onended = () => toggleScreenShare();

            if (localStreamRef.current) {
                const oldTrack = localStreamRef.current.getVideoTracks()[0];
                if (oldTrack) {
                    oldTrack.stop(); 
                    localStreamRef.current.removeTrack(oldTrack);
                }
                localStreamRef.current.addTrack(screenTrack);
                
                Object.values(peersRef.current).forEach((p: Peer) => {
                    const sender = p.connection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                });
            }
            setIsScreenSharing(true);
            setIsVideoEnabled(true);
        } catch (e) { 
            console.error("Screen share failed", e);
        }
    }
  };

  return (
    <motion.div 
      {...theme.motion.page}
      style={{ 
        ...commonStyles.pageContainer, 
        background: '#000', 
        position: 'fixed', inset: 0, zIndex: 2000,
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden'
      }}
    >
        {/* Full Screen Overlay */}
        <AnimatePresence>
            {fullScreenPeerId && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ position: 'absolute', inset: 0, zIndex: 3000, background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setFullScreenPeerId(null)}
                >
                    {fullScreenPeerId === 'local' ? (
                        <video 
                            ref={(el) => { if(el && localStreamRef.current) el.srcObject = localStreamRef.current; }}
                            autoPlay muted playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                        />
                    ) : (
                         peers[fullScreenPeerId] && (
                            <FullScreenVideo peer={peers[fullScreenPeerId]} />
                         )
                    )}
                    <button style={{ position: 'absolute', top: 24, right: 24, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', border: 'none', color: 'white', padding: '12px' }}>
                        <ArrowsOut size={24} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>

        <div style={{ padding: '32px', textAlign: 'center', zIndex: 10 }}>
            <h2 style={{ color: theme.colors.text2, fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Group Link
            </h2>
            <p style={{ color: theme.colors.text3, fontSize: '12px', marginTop: '8px' }}>{status}</p>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', padding: '24px', overflowY: 'auto' }}>
            {/* Me */}
            <div 
                onClick={() => (isVideoEnabled || isScreenSharing) && setFullScreenPeerId('local')}
                style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: (isVideoEnabled || isScreenSharing) ? 'pointer' : 'default' }}
            >
                <div style={{ 
                    width: isVideoEnabled || isScreenSharing ? '240px' : '100px', 
                    height: isVideoEnabled || isScreenSharing ? '180px' : '100px', 
                    borderRadius: isVideoEnabled ? '16px' : '50%', 
                    background: theme.colors.surface3, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${theme.colors.surface2}`,
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                }}>
                    <video 
                        ref={localVideoRef} 
                        autoPlay muted playsInline
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

            {/* Remote Peers */}
            {Object.values(peers).map((peer: Peer) => (
                <RemotePeer key={peer.id} peer={peer} onMaximize={() => setFullScreenPeerId(peer.id)} />
            ))}
        </div>

        <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center', gap: '24px', background: 'linear-gradient(to top, #000 0%, transparent 100%)' }}>
            <ControlButton onClick={toggleMute} active={!isMuted} icon={isMuted ? MicrophoneSlash : Microphone} />
            <ControlButton onClick={toggleVideo} active={isVideoEnabled && !isScreenSharing} icon={isVideoEnabled && !isScreenSharing ? VideoCamera : VideoCameraSlash} />
            <ControlButton onClick={toggleScreenShare} active={isScreenSharing} icon={isScreenSharing ? Screencast : DesktopTower} />
            
            <motion.button
               whileTap={{ scale: 0.9 }}
               onClick={() => navigate(-1)}
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

const RemotePeer: React.FC<{ peer: Peer, onMaximize: () => void }> = ({ peer, onMaximize }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasVideo, setHasVideo] = useState(false);

    useEffect(() => {
        // Force attachment when stream changes
        if (peer.stream && videoRef.current) {
            videoRef.current.srcObject = peer.stream;
        }

        // Monitoring Loop
        const interval = setInterval(() => {
            if (peer.stream) {
                const vidTrack = peer.stream.getVideoTracks()[0];
                const active = !!(vidTrack && vidTrack.enabled && !vidTrack.muted);
                setHasVideo(active);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [peer.stream]);

    return (
        <motion.div 
           initial={{ opacity: 0, scale: 0.5 }}
           animate={{ opacity: 1, scale: 1 }}
           onClick={() => hasVideo && onMaximize()}
           style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: hasVideo ? 'pointer' : 'default' }}
        >
             <div style={{ 
                width: hasVideo ? '240px' : '100px', 
                height: hasVideo ? '180px' : '100px', 
                borderRadius: hasVideo ? '16px' : '50%', 
                background: theme.colors.surface3, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                overflow: 'hidden',
                border: `2px solid ${theme.colors.border}`,
                transition: 'all 0.3s ease'
             }}>
                 <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: hasVideo ? 'block' : 'none' }} autoPlay playsInline />
                 {!hasVideo && <Users size={32} color={theme.colors.text2} />}
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

const ControlButton = ({ onClick, active, icon: Icon }: any) => (
    <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: active ? theme.colors.text1 : 'rgba(255,255,255,0.1)',
            color: active ? '#000' : theme.colors.text1,
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)', cursor: 'pointer'
        }}
    >
        <Icon size={24} weight="fill" />
    </motion.button>
);
