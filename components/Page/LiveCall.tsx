import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Peer from 'peerjs';
import { motion } from 'framer-motion';
import { Microphone, MicrophoneSlash, PhoneDisconnect, VideoCamera, VideoCameraSlash, WifiHigh, WifiSlash, WarningCircle, Users, Screencast } from '@phosphor-icons/react';
import { theme, commonStyles, DS } from '../../Theme';
import { api } from '../../services/supabaseClient';
import { CurrentUser } from '../../types';

// Check for screen sharing support once
const isScreenShareSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

export const LiveCall: React.FC = () => {
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
    const currentCallRef = useRef<Peer.MediaConnection | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    
    // Ref to get latest state in callbacks
    const isScreenSharingRef = useRef(isScreenSharing);
    useEffect(() => {
        isScreenSharingRef.current = isScreenSharing;
    }, [isScreenSharing]);

    const leaveCall = useCallback(() => {
        // This function is the primary cleanup handler for user-initiated call endings.
        // It's more explicit than relying solely on the component unmount lifecycle.
        
        // Stop all media tracks to release camera/mic
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        screenStreamRef.current?.getTracks().forEach(track => track.stop());

        // Clean up video elements to prevent frozen frames
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        
        // Gracefully close the PeerJS media connection
        currentCallRef.current?.close();
        
        // Destroy the core Peer object to disconnect from the signaling server
        if (peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.destroy();
        }
        
        // Clear refs to prevent stale data
        peerRef.current = null;
        currentCallRef.current = null;
        localStreamRef.current = null;
        screenStreamRef.current = null;

        // Navigate away from the call screen
        navigate(-1);
    }, [navigate]);

    useEffect(() => {
        let peer: Peer | null = null;
        let localStream: MediaStream | null = null;
        
        const init = async () => {
            try {
                const user = await api.getCurrentUser();
                setCurrentUser(user);

                setStatus('Requesting permissions...');
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                localStream = stream; // Capture stream for cleanup
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                setStatus('Connecting to network...');
                peer = new Peer(user.id, {
                    // Using PeerJS's default cloud server. For production, a self-hosted server is recommended.
                });
                peerRef.current = peer;

                const handleCallEvents = (call: Peer.MediaConnection) => {
                    currentCallRef.current = call;
                    call.on('stream', (remoteStream: MediaStream) => {
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

                peer.on('open', (id) => {
                    setStatus('Ringing...');
                    if (friendId) {
                        const call = peer!.call(friendId, stream);
                        handleCallEvents(call);
                    }
                });

                peer.on('call', (call) => {
                    setStatus('Incoming call...');
                    call.answer(stream);
                    handleCallEvents(call);
                });

                peer.on('error', (err: any) => {
                    console.error('PeerJS error:', err);
                    let message = `Error: ${err.message}`;
                    if (err.type === 'peer-unavailable') {
                        message = 'User is not available.';
                    } else if (err.type === 'unavailable-id') {
                        message = "Connection ID is taken. Please try again shortly.";
                    }
                    setStatus(message);
                    setCallEstablished(false);
                });
                
                peer.on('disconnected', () => {
                    setStatus('Reconnecting network...');
                    if (peerRef.current && !peerRef.current.destroyed) {
                         peerRef.current.reconnect();
                    }
                });

            } catch (err: any) {
                const msg = err.name === 'NotAllowedError' ? 'Permissions denied.' : 'Media devices not found.';
                setStatus(`Error: ${msg}`);
            }
        };

        init();
        
        // This acts as a safety net for cleanup if the component unmounts unexpectedly
        // (e.g., browser back button), but leaveCall is the primary mechanism.
        return () => {
            localStream?.getTracks().forEach(track => track.stop());
            if (peer && !peer.destroyed) {
                peer.destroy();
            }
        };
    }, [friendId, leaveCall]);

    const toggleMute = () => {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !newMutedState);
    };

    const toggleVideo = () => {
        if (isScreenSharing) return;
        const enabled = !isVideoEnabled;
        localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = enabled);
        setIsVideoEnabled(enabled);
    };
    
    const toggleScreenShare = async () => {
        if (!currentCallRef.current) return;

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
            const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
            if (cameraTrack) {
                await videoSender.replaceTrack(cameraTrack);
                screenStreamRef.current?.getTracks().forEach(track => track.stop());
                screenStreamRef.current = null;
                setIsScreenSharing(false);
                cameraTrack.enabled = isVideoEnabled;
            }
        } else {
            // Start screen sharing
            try {
                const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                const screenTrack = displayStream.getVideoTracks()[0];
                screenStreamRef.current = displayStream;

                const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
                if (cameraTrack) cameraTrack.enabled = false;
                
                await videoSender.replaceTrack(screenTrack);
                setIsScreenSharing(true);

                screenTrack.onended = () => {
                    if (isScreenSharingRef.current && cameraTrack) {
                        videoSender.replaceTrack(cameraTrack);
                        screenStreamRef.current?.getTracks().forEach(track => track.stop());
                        screenStreamRef.current = null;
                        setIsScreenSharing(false);
                        cameraTrack.enabled = isVideoEnabled;
                    }
                };

            } catch (err) {
                console.error("Could not start screen share", err);
                setStatus("Screen share cancelled or failed.");
            }
        }
    };

    const getStatusIcon = () => {
        if (status.startsWith('Error') || status.includes('not available') || status.includes('taken')) {
            return <WifiSlash weight="fill" color={DS.Color.Status.Error} />;
        }
        if (callEstablished) return <WifiHigh weight="fill" color="#22c55e" />;
        return <Users weight="thin" />;
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
                <video ref={remoteVideoRef} autoPlay playsInline style={{ 
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%', objectFit: 'cover',
                    transition: 'opacity 0.5s ease', opacity: callEstablished ? 1 : 0
                }} />
                
                {!callEstablished && (
                    <div style={{ ...commonStyles.flexCenter, flexDirection: 'column', gap: '16px', color: DS.Color.Base.Content[2] }}>
                        <Users size={48} weight="thin" />
                        <p style={{ fontSize: '14px' }}>Waiting for connection...</p>
                    </div>
                )}
                
                <motion.div 
                    drag dragConstraints={{ top: -200, left: -200, right: 200, bottom: 200 }}
                    style={{
                        position: 'absolute', bottom: '140px', right: '24px',
                        width: '120px', height: '180px', borderRadius: '16px',
                        background: DS.Color.Base.Surface[3],
                        overflow: 'hidden',
                        border: `2px solid ${isScreenSharing ? DS.Color.Accent.Surface : 'rgba(255,255,255,0.2)'}`,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)', cursor: 'grab',
                        transition: 'border 0.3s'
                    }} 
                >
                    <video ref={localVideoRef} autoPlay muted playsInline 
                        style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            transform: 'scaleX(-1)',
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
            <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center', gap: '24px', background: 'linear-gradient(to top, #000 0%, transparent 100%)', zIndex: 10 }}>
                <ControlButton onClick={toggleMute} active={!isMuted} icon={isMuted ? MicrophoneSlash : Microphone} />
                <ControlButton onClick={toggleVideo} active={isVideoEnabled && !isScreenSharing} disabled={isScreenSharing} icon={isVideoEnabled ? VideoCamera : VideoCameraSlash} />
                {isScreenShareSupported && <ControlButton onClick={toggleScreenShare} active={isScreenSharing} icon={Screencast} activeColor={DS.Color.Accent.Surface} />}
                
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
