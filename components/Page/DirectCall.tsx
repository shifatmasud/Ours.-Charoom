import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Peer from 'peerjs';
import { motion } from 'framer-motion';
import { Microphone, MicrophoneSlash, PhoneDisconnect, VideoCamera, VideoCameraSlash, WifiHigh, WifiSlash, WarningCircle, Users, Screencast } from '@phosphor-icons/react';
import { theme, commonStyles, DS } from '../../Theme';
import { api } from '../../services/supabaseClient';
import { CurrentUser } from '../../types';

export const DirectCall: React.FC = () => {
    const { friendId } = useParams<{ friendId: string }>();
    const navigate = useNavigate();

    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [status, setStatus] = useState('Initializing...');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [callEstablished, setCallEstablished] = useState(false);
    
    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const currentCallRef = useRef<any>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    
    // Ref to get latest state in callbacks
    const isScreenSharingRef = useRef(isScreenSharing);
    useEffect(() => {
        isScreenSharingRef.current = isScreenSharing;
    }, [isScreenSharing]);

    const cleanup = () => {
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        if (currentCallRef.current) {
            currentCallRef.current.close();
        }
        if (peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.destroy();
        }
    };

    const leaveCall = () => {
        setStatus('Call ended.');
        cleanup();
        navigate(-1);
    };

    useEffect(() => {
        let isMounted = true;
        
        const init = async () => {
            try {
                const user = await api.getCurrentUser();
                if (!isMounted) return;
                setCurrentUser(user);

                setStatus('Requesting permissions...');
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return; }
                
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                setStatus('Connecting to network...');
                
                // Using custom Metered TURN servers for improved connection reliability.
                // The PeerJS cloud service is still used for signaling to connect peers.
                const peer = new Peer(user.id, {
                    host: '0.peerjs.com', 
                    port: 443,
                    path: '/',
                    pingInterval: 5000,
                    config: {
                        iceServers: [
                          {
                            urls: "stun:stun.relay.metered.ca:80",
                          },
                          {
                            urls: "turn:global.relay.metered.ca:80",
                            username: "c471bbe57a75148f4bb4e9ef",
                            credential: "cWdboQRIH0/hBLhd",
                          },
                          {
                            urls: "turn:global.relay.metered.ca:80?transport=tcp",
                            username: "c471bbe57a75148f4bb4e9ef",
                            credential: "cWdboQRIH0/hBLhd",
                          },
                          {
                            urls: "turn:global.relay.metered.ca:443",
                            username: "c471bbe57a75148f4bb4e9ef",
                            credential: "cWdboQRIH0/hBLhd",
                          },
                          {
                            urls: "turns:global.relay.metered.ca:443?transport=tcp",
                            username: "c471bbe57a75148f4bb4e9ef",
                            credential: "cWdboQRIH0/hBLhd",
                          },
                        ]
                    }
                });
                peerRef.current = peer;

                const handleCallEvents = (call: any) => {
                    currentCallRef.current = call;
                    call.on('stream', (remoteStream: MediaStream) => {
                        remoteStreamRef.current = remoteStream;
                        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                        setStatus('Connected');
                        setCallEstablished(true);
                    });
                    call.on('close', leaveCall);
                    call.on('error', (err: any) => {
                        console.error('Call error:', err);
                        setStatus('Call error.');
                        leaveCall();
                    });
                }

                peer.on('open', () => {
                    if (!isMounted) return;
                    setStatus('Ringing...');
                    if (friendId) {
                        const call = peer.call(friendId, stream);
                        handleCallEvents(call);
                    }
                });

                peer.on('call', (call) => {
                    if (!isMounted) return;
                    setStatus('Incoming call...');
                    call.answer(stream);
                    handleCallEvents(call);
                });

                peer.on('error', (err) => {
                    console.error('PeerJS error:', err);
                    setStatus(`Error: ${err.message}`);
                    setCallEstablished(false);
                });
                
                peer.on('disconnected', () => {
                    setStatus('Reconnecting network...');
                    peer.reconnect();
                });

            } catch (err: any) {
                const msg = err.name === 'NotAllowedError' ? 'Permissions denied.' : 'Media devices not found.';
                setStatus(`Error: ${msg}`);
            }
        };

        init();
        
        const handleUnload = () => cleanup();
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            isMounted = false;
            cleanup();
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [friendId, navigate]);

    const toggleMute = () => {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !newMutedState);
    };

    const toggleVideo = () => {
        if (isScreenSharing) return; // Don't allow camera toggle during screen share
        const enabled = !isVideoEnabled;
        localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = enabled);
        setIsVideoEnabled(enabled);
    };

    const toggleScreenShare = async () => {
        if (!currentCallRef.current || !localStreamRef.current) return;

        const videoSender = currentCallRef.current.peerConnection.getSenders().find(
            (s: RTCRtpSender) => s.track?.kind === 'video'
        );

        if (!videoSender) {
            console.error("No video sender found");
            setStatus("Error: Could not share screen.");
            return;
        }

        if (isScreenSharingRef.current) {
            // Stop screen sharing and switch back to camera
            try {
                const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                const newTrack = cameraStream.getVideoTracks()[0];
                const oldTrack = localStreamRef.current.getVideoTracks()[0];

                await videoSender.replaceTrack(newTrack);

                localStreamRef.current.removeTrack(oldTrack);
                localStreamRef.current.addTrack(newTrack);
                oldTrack.stop();
                
                newTrack.enabled = true;
                setIsVideoEnabled(true);
                setIsScreenSharing(false);
            } catch (err) {
                console.error("Could not switch to camera", err);
                setStatus("Error: Camera not available.");
            }
        } else {
            // Start screen sharing
            try {
                const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const newTrack = displayStream.getVideoTracks()[0];
                const oldTrack = localStreamRef.current.getVideoTracks()[0];

                newTrack.onended = () => {
                    if (isScreenSharingRef.current) {
                        toggleScreenShare();
                    }
                };

                await videoSender.replaceTrack(newTrack);

                localStreamRef.current.removeTrack(oldTrack);
                localStreamRef.current.addTrack(newTrack);
                oldTrack.stop();

                setIsScreenSharing(true);
                setIsVideoEnabled(true);
            } catch (err) {
                console.error("Could not start screen share", err);
                setStatus("Screen share cancelled.");
            }
        }
    };

    const getStatusIcon = () => {
        if (status.startsWith('Error')) return <WifiSlash weight="fill" color={DS.Color.Status.Error} />;
        if (callEstablished) return <WifiHigh weight="fill" color="#22c55e" />;
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
            {/* Status Bar */}
            <div style={{ padding: '32px', textAlign: 'center', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
                <div style={{ 
                    background: status.startsWith('Error') ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255,255,255,0.05)', 
                    color: status.startsWith('Error') ? DS.Color.Status.Error : DS.Color.Base.Content[3],
                    border: `1px solid ${status.startsWith('Error') ? DS.Color.Status.Error : 'rgba(255,255,255,0.1)'}`,
                    padding: '8px 16px', borderRadius: DS.Radius.Full,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '12px', backdropFilter: 'blur(10px)',
                }}>
                    {getStatusIcon()}
                    {status}
                </div>
            </div>

            {/* Video Area */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                {/* Remote Video (Fullscreen Background) */}
                <video ref={remoteVideoRef} autoPlay playsInline style={{ 
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%', objectFit: 'cover',
                    transition: 'opacity 0.5s ease', opacity: callEstablished ? 1 : 0
                }} />
                
                {/* Waiting State */}
                {!callEstablished && (
                    <div style={{ ...commonStyles.flexCenter, flexDirection: 'column', gap: '16px', color: DS.Color.Base.Content[2] }}>
                        <Users size={48} weight="thin" />
                        <p style={{ fontSize: '14px' }}>Connecting to peer...</p>
                    </div>
                )}
                
                {/* Local Video (Picture-in-Picture) */}
                <motion.div 
                    drag dragConstraints={{ top: -200, left: -200, right: 200, bottom: 200 }}
                    style={{
                        position: 'absolute', bottom: '140px', right: '24px',
                        width: '120px', height: '180px', borderRadius: '16px',
                        background: DS.Color.Base.Surface[3],
                        overflow: 'hidden',
                        border: `2px solid rgba(255,255,255,0.2)`,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)', cursor: 'grab'
                    }} 
                >
                    <video ref={localVideoRef} autoPlay muted playsInline 
                        style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            transform: isScreenSharing ? 'scaleX(1)' : 'scaleX(-1)', // Don't mirror screen share
                            display: isVideoEnabled ? 'block' : 'none'
                        }}
                    />
                    {!isVideoEnabled && (
                        <div style={{ ...commonStyles.flexCenter, width: '100%', height: '100%', background: '#000' }}>
                            <span style={{ fontSize: '32px', color: 'white' }}>{currentUser?.username?.charAt(0).toUpperCase()}</span>
                        </div>
                    )}
                </motion.div>
            </div>
            
            {/* Controls */}
            <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center', gap: '24px', background: 'linear-gradient(to top, #000 0%, transparent 100%)' }}>
                <ControlButton onClick={toggleMute} active={!isMuted} icon={isMuted ? MicrophoneSlash : Microphone} />
                <ControlButton onClick={toggleVideo} active={isVideoEnabled && !isScreenSharing} disabled={isScreenSharing} icon={isVideoEnabled ? VideoCamera : VideoCameraSlash} />
                <ControlButton onClick={toggleScreenShare} active={isScreenSharing} icon={Screencast} activeColor={DS.Color.Accent.Surface} />
                
                <motion.button whileTap={{ scale: 0.9 }} onClick={leaveCall}
                   style={{
                       width: '64px', height: '64px', borderRadius: '50%',
                       background: DS.Color.Status.Error, color: '#fff',
                       border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                       boxShadow: `0 0 20px rgba(255, 51, 0, 0.4)`, cursor: 'pointer'
                   }}
                >
                    <PhoneDisconnect size={28} weight="fill" />
                </motion.button>
            </div>
        </motion.div>
    );
};

const ControlButton = ({ onClick, active, icon: Icon, disabled, activeColor }: any) => (
    <motion.button
        whileTap={!disabled ? { scale: 0.9 } : {}}
        onClick={onClick}
        disabled={disabled}
        style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: active ? (activeColor || DS.Color.Base.Content[1]) : 'rgba(255,255,255,0.1)',
            color: active ? (activeColor ? '#fff' : '#000') : DS.Color.Base.Content[1],
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s, color 0.2s, opacity 0.2s',
            opacity: disabled ? 0.5 : 1
        }}
    >
        <Icon size={24} weight="fill" />
    </motion.button>
);