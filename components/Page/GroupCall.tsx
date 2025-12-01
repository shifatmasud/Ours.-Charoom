
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Microphone, MicrophoneSlash, PhoneDisconnect, Users, VideoCamera, VideoCameraSlash, Screencast, DesktopTower } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { theme, commonStyles } from '../../Theme';
import { api, supabase } from '../../services/supabaseClient';
import { CurrentUser } from '../../types';

// --- types ---
interface Peer {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  username?: string;
  isVideoEnabled?: boolean;
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
  const [status, setStatus] = useState('Initializing void...');

  // Refs for stability in callbacks
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, Peer>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidate[]>>({});
  const userRef = useRef<CurrentUser | null>(null);
  const channelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // --- Cleanup ---
  const leaveCall = () => {
    // Stop tracks
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    
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

        // 1. Get Audio (Initial)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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

            // If we have a stale/failed connection for this user, clean it up first
            const existing = peersRef.current[payload.userId];
            if (existing && (existing.connection.connectionState === 'failed' || existing.connection.connectionState === 'closed')) {
                console.log("Cleaning up stale connection for", payload.userId);
                existing.connection.close();
                delete peersRef.current[payload.userId];
                setPeers(prev => {
                    const next = { ...prev };
                    delete next[payload.userId];
                    return next;
                });
            }

            // If someone joins, we (existing user) initiate the connection
            createPeer(payload.userId, true);
        });

        channel.on('broadcast', { event: 'signal' }, async ({ payload }: any) => {
            if (payload.to !== user.id) return; // Not for me
            
            const { from, type, data } = payload;
            
            if (type === 'offer') {
                const peer = createPeer(from, false);
                try {
                    await peer.connection.setRemoteDescription(new RTCSessionDescription(data));
                    
                    // Process any queued candidates that arrived before the offer
                    const pending = pendingCandidatesRef.current[from];
                    if (pending && pending.length > 0) {
                        console.log(`Processing ${pending.length} queued candidates for ${from}`);
                        for (const candidate of pending) {
                            await peer.connection.addIceCandidate(candidate).catch(e => console.warn("Failed to add queued candidate", e));
                        }
                        delete pendingCandidatesRef.current[from];
                    }

                    const answer = await peer.connection.createAnswer();
                    await peer.connection.setLocalDescription(answer);
                    
                    channel.send({
                        type: 'broadcast',
                        event: 'signal',
                        payload: { to: from, from: user.id, type: 'answer', data: answer }
                    });
                } catch(e) { console.error("Offer error", e); }
            } else if (type === 'answer') {
                const peer = peersRef.current[from];
                if (peer) {
                    try {
                        await peer.connection.setRemoteDescription(new RTCSessionDescription(data));
                        // Also process pending candidates here just in case
                        const pending = pendingCandidatesRef.current[from];
                        if (pending && pending.length > 0) {
                            for (const candidate of pending) {
                                await peer.connection.addIceCandidate(candidate).catch(e => console.warn(e));
                            }
                            delete pendingCandidatesRef.current[from];
                        }
                    } catch(e) { console.error("Answer error", e); }
                }
            } else if (type === 'candidate') {
                const candidate = new RTCIceCandidate(data);
                const peer = peersRef.current[from];
                
                if (peer && peer.connection.remoteDescription) {
                    try {
                        await peer.connection.addIceCandidate(candidate);
                    } catch (e) { console.error('Error adding candidate', e); }
                } else {
                    // Queue candidate if peer doesn't exist or isn't ready
                    console.log(`Queuing candidate for ${from}`);
                    if (!pendingCandidatesRef.current[from]) pendingCandidatesRef.current[from] = [];
                    pendingCandidatesRef.current[from].push(candidate);
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
      // Cleanup handled by leaveCall logic if navigation happens, but extra safety:
      if (channelRef.current) supabase?.removeChannel(channelRef.current);
    };
  }, [roomId]);

  // --- WebRTC Logic ---

  const createPeer = (targetId: string, initiator: boolean) => {
     if (peersRef.current[targetId]) return peersRef.current[targetId];

     console.log(`Creating peer for ${targetId} (initiator: ${initiator})`);
     const pc = new RTCPeerConnection(ICE_SERVERS);
     
     // Add local tracks
     if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
        });
     }

     // Handle remote tracks
     pc.ontrack = (event) => {
         console.log(`Track received from ${targetId}`, event.streams[0]);
         const stream = event.streams[0];
         const hasVideo = stream.getVideoTracks().length > 0;
         
         setPeers(prev => ({
             ...prev,
             [targetId]: { ...prev[targetId], stream, isVideoEnabled: hasVideo }
         }));
     };

     // Handle Renegotiation
     pc.onnegotiationneeded = async () => {
        try {
            // Simple check to avoid glare if we are not the polite peer or if state is weird
            if (pc.signalingState !== 'stable') return;
            
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
        } catch(e) { console.error("Renegotiation failed", e); }
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

     // Dump any global queued candidates for this peer (if they arrived really early)
     // Note: They will likely fail to add here if remoteDesc is not set, 
     // but the signal handler loop handles the 'offer' arrival case.
     // This block is mostly useful if we are the initiator and somehow got candidates back super fast? 
     // Unlikely for initiator.
     
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
          setIsMuted(!isMuted);
      }
  };

  const toggleVideo = async () => {
      if (isVideoEnabled) {
          // Stop video
          localStreamRef.current?.getVideoTracks().forEach(t => {
              t.stop();
              localStreamRef.current?.removeTrack(t);
          });
          
          // Remove from peers
          Object.values(peersRef.current).forEach((peer: Peer) => {
              const senders = peer.connection.getSenders();
              const videoSender = senders.find(s => s.track?.kind === 'video');
              if (videoSender) {
                  peer.connection.removeTrack(videoSender);
              }
          });

          if (localVideoRef.current) localVideoRef.current.srcObject = null;
          setIsVideoEnabled(false);
          setIsScreenSharing(false);
      } else {
          // Start Video
          try {
              const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
              const videoTrack = videoStream.getVideoTracks()[0];
              
              if (localStreamRef.current) {
                  localStreamRef.current.addTrack(videoTrack);
                  
                  // Add to all peers
                  Object.values(peersRef.current).forEach((peer: Peer) => {
                      peer.connection.addTrack(videoTrack, localStreamRef.current!);
                  });
                  
                  if (localVideoRef.current) {
                      localVideoRef.current.srcObject = new MediaStream([videoTrack]);
                      localVideoRef.current.play();
                  }
                  setIsVideoEnabled(true);
                  setIsScreenSharing(false);
              }
          } catch(e) { 
              console.error("Failed to start video", e); 
              alert("Could not access camera");
          }
      }
  };

  const toggleScreenShare = async () => {
      if (isScreenSharing) {
          localStreamRef.current?.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current?.removeTrack(t); });
          Object.values(peersRef.current).forEach((peer: Peer) => {
            const senders = peer.connection.getSenders();
            const videoSender = senders.find(s => s.track?.kind === 'video');
            if (videoSender) peer.connection.removeTrack(videoSender);
          });
          
          setIsScreenSharing(false);
          setIsVideoEnabled(false);
          if (localVideoRef.current) localVideoRef.current.srcObject = null;

      } else {
          try {
              const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
              const screenTrack = screenStream.getVideoTracks()[0];
              
              screenTrack.onended = () => {
                  setIsScreenSharing(false);
                  setIsVideoEnabled(false);
                  if (localVideoRef.current) localVideoRef.current.srcObject = null;
                  localStreamRef.current?.removeTrack(screenTrack);
                   Object.values(peersRef.current).forEach((peer: Peer) => {
                    const senders = peer.connection.getSenders();
                    const videoSender = senders.find(s => s.track?.kind === 'video');
                    if (videoSender) peer.connection.removeTrack(videoSender);
                  });
              };

              const existingVideoTrack = localStreamRef.current?.getVideoTracks()[0];
              if (existingVideoTrack) {
                  existingVideoTrack.stop();
                  localStreamRef.current?.removeTrack(existingVideoTrack);
              }

              localStreamRef.current?.addTrack(screenTrack);
              
              Object.values(peersRef.current).forEach((peer: Peer) => {
                  const senders = peer.connection.getSenders();
                  const videoSender = senders.find(s => s.track?.kind === 'video');
                  if (videoSender) {
                      videoSender.replaceTrack(screenTrack);
                  } else {
                      peer.connection.addTrack(screenTrack, localStreamRef.current!);
                  }
              });

              if (localVideoRef.current) {
                  localVideoRef.current.srcObject = new MediaStream([screenTrack]);
                  localVideoRef.current.play();
              }
              
              setIsScreenSharing(true);
              setIsVideoEnabled(true);

          } catch (e) { console.error("Screen share failed", e); }
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
        {/* Header */}
        <div style={{ padding: '32px', textAlign: 'center', zIndex: 10 }}>
            <h2 style={{ color: theme.colors.text2, fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                Codex Channel
            </h2>
            <p style={{ color: theme.colors.text3, fontSize: '12px', marginTop: '8px' }}>{status}</p>
        </div>

        {/* Participants Grid */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', padding: '24px', overflowY: 'auto' }}>
            
            {/* Me */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
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
                    <video ref={localVideoRef} muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: isVideoEnabled || isScreenSharing ? 'block' : 'none' }} />
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
                <RemotePeer key={peer.id} peer={peer} />
            ))}
        </div>

        {/* Controls */}
        <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center', gap: '24px', background: 'linear-gradient(to top, #000 0%, transparent 100%)' }}>
            <ControlButton onClick={toggleMute} active={!isMuted} icon={isMuted ? MicrophoneSlash : Microphone} />
            <ControlButton onClick={toggleVideo} active={isVideoEnabled && !isScreenSharing} icon={isVideoEnabled && !isScreenSharing ? VideoCamera : VideoCameraSlash} />
            <ControlButton onClick={toggleScreenShare} active={isScreenSharing} icon={isScreenSharing ? Screencast : DesktopTower} />
            
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

const RemotePeer: React.FC<{ peer: Peer }> = ({ peer }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasVideo, setHasVideo] = useState(false);

    useEffect(() => {
        if (peer.stream && videoRef.current) {
            videoRef.current.srcObject = peer.stream;
            videoRef.current.play().catch(e => console.error("Play error", e));
            
            // Check tracks
            const checkVideo = () => {
               const videoTracks = peer.stream?.getVideoTracks() || [];
               setHasVideo(videoTracks.some(t => t.readyState === 'live' && t.enabled));
            };
            checkVideo();
            
            peer.stream.addEventListener('addtrack', checkVideo);
            peer.stream.addEventListener('removetrack', checkVideo);
            return () => {
                 peer.stream?.removeEventListener('addtrack', checkVideo);
                 peer.stream?.removeEventListener('removetrack', checkVideo);
            };
        }
    }, [peer.stream]);

    return (
        <motion.div 
           initial={{ opacity: 0, scale: 0.5 }}
           animate={{ opacity: 1, scale: 1 }}
           style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
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
