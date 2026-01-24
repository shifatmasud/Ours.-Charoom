
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Peer from 'peerjs';
import { motion } from 'framer-motion';
import { Microphone, MicrophoneSlash, PhoneDisconnect, VideoCamera, VideoCameraSlash, WifiHigh, WifiSlash, WarningCircle, Users } from '@phosphor-icons/react';
import { theme, commonStyles } from '../../Theme';
import { api } from '../../services/supabaseClient';
import { CurrentUser } from '../../types';

export const LiveCall: React.FC = () => {
    const { friendId } = useParams<{ friendId: string }>();
    const navigate = useNavigate();

    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [status, setStatus] = useState('Initializing...');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [callEstablished, setCallEstablished] = useState(false);
    
    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const currentCallRef = useRef<any>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const cleanup = () => {
        // Stop all media tracks
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        remoteStreamRef.current?.getTracks().forEach(track => track.stop());
        
        // Close any active call
        if (currentCallRef.current) {
            currentCallRef.current.close();
            currentCallRef.current = null;
        }

        // Disconnect from PeerJS server
        if (peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.destroy();
        }
        
        peerRef.current = null;
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

                setStatus('Connecting to signaling server...');
                const peer = new Peer(user.id, {
                    // For production, a self-hosted PeerServer is recommended for reliability.
                    // The public server is great for development and small-scale apps.
                    host: '0.peerjs.com', 
                    port: 443,
                    path: '/',
                    pingInterval: 5000
                });
                peerRef.current = peer;

                peer.on('open', (id) => {
                    if (!isMounted) return;
                    setStatus('Ready to call...');
                    if (friendId) {
                        console.log(`Calling peer: ${friendId}`);
                        const call = peer.call(friendId, stream);
                        currentCallRef.current = call;
                        call.on('stream', handleRemoteStream);
                        call.on('close', leaveCall);
                    }
                });

                peer.on('call', (call) => {
                    if (!isMounted) return;
                    setStatus('Incoming call...');
                    call.answer(stream);
                    currentCallRef.current = call;
                    call.on('stream', handleRemoteStream);
                    call.on('close', leaveCall);
                });

                peer.on('error', (err) => {
                    console.error('PeerJS error:', err);
                    setStatus(`Error: ${err.message}`);
                    setCallEstablished(false);
                });
                
                peer.on('disconnected', () => {
                    setStatus('Disconnected from server. Reconnecting...');
                    peer.reconnect();
                });

            } catch (err: any) {
                const msg = err.name === 'NotAllowedError' ? 'Permissions denied.' : 'Media devices not found.';
                setStatus(`Error: ${msg}`);
            }
        };

        init();
        
        return () => {
            isMounted = false;
            cleanup();
        };
    }, [friendId, navigate]);

    const handleRemoteStream = (stream: MediaStream) => {
        remoteStreamRef.current = stream;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        setStatus('Connected');
        setCallEstablished(true);
    };

    const toggleMute = () => {
        const enabled = !isMuted;
        localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = enabled);
        setIsMuted(!enabled);
    };

    const toggleVideo = () => {
        const enabled = !isVideoEnabled;
        localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = enabled);
        setIsVideoEnabled(!enabled);
    };

    const getStatusIcon = () => {
        if (status.startsWith('Error')) return <WifiSlash weight="fill" color={theme.colors.danger} />;
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
            <div style={{ padding: '32px', textAlign: 'center', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
                <div style={{ 
                    background: status.startsWith('Error') ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255,255,255,0.05)', 
                    color: status.startsWith('Error') ? theme.colors.danger : theme.colors.text3,
                    border: `1px solid ${status.startsWith('Error') ? theme.colors.danger : 'rgba(255,255,255,0.1)'}`,
                    padding: '8px 16px', borderRadius: theme.radius.full,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '12px', backdropFilter: 'blur(10px)',
                }}>
                    {getStatusIcon()}
                    {status}
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                {/* Remote Video (Fullscreen Background) */}
                <video ref={remoteVideoRef} autoPlay playsInline style={{ 
                    width: '100%', height: '100%', objectFit: 'cover',
                    transition: 'opacity 0.5s ease', opacity: callEstablished ? 1 : 0
                }} />
                
                {/* Waiting / No-Video State */}
                {!callEstablished && (
                    <div style={{ ...commonStyles.flexCenter, flexDirection: 'column', gap: '16px', color: theme.colors.text2 }}>
                        <Users size={48} weight="thin" />
                        <p style={{ fontSize: '14px' }}>Waiting for peer to connect...</p>
                    </div>
                )}
                
                {/* Local Video (Picture-in-Picture) */}
                <motion.div 
                    drag dragConstraints={{ top: -200, left: -200, right: 200, bottom: 200 }}
                    style={{
                        position: 'absolute', bottom: '140px', right: '24px',
                        width: '120px', height: '180px', borderRadius: '16px',
                        background: theme.colors.surface3,
                        overflow: 'hidden',
                        border: `2px solid rgba(255,255,255,0.2)`,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)', cursor: 'grab'
                    }} 
                >
                    <video ref={localVideoRef} autoPlay muted playsInline 
                        style={{
                            width: '100%', height: '100%', objectFit: 'cover',
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
            
            <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center', gap: '24px', background: 'linear-gradient(to top, #000 0%, transparent 100%)' }}>
                <ControlButton onClick={toggleMute} active={!isMuted} icon={isMuted ? MicrophoneSlash : Microphone} />
                <ControlButton onClick={toggleVideo} active={isVideoEnabled} icon={isVideoEnabled ? VideoCamera : VideoCameraSlash} />
                
                <motion.button whileTap={{ scale: 0.9 }} onClick={leaveCall}
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

const ControlButton = ({ onClick, active, icon: Icon }: any) => (
    <motion.button
        whileTap={{ scale: 0.9 }} onClick={onClick}
        style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: active ? theme.colors.text1 : 'rgba(255,255,255,0.1)',
            color: active ? '#000' : theme.colors.text1,
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)', cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s'
        }}
    >
        <Icon size={24} weight="fill" />
    </motion.button>
);