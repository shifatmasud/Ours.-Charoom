import React, { useEffect, useState, useRef, useCallback, useReducer } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Peer from 'peerjs';
import { motion } from 'framer-motion';
import { Microphone, MicrophoneSlash, PhoneDisconnect, VideoCamera, VideoCameraSlash, WifiHigh, WifiSlash, Users, Screencast } from '@phosphor-icons/react';
import { theme, commonStyles, DS } from '../../Theme';
import { api } from '../../services/supabaseClient';
import { CurrentUser } from '../../types';

const isScreenShareSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

// --- State Management with Reducer for predictable states ---
type CallState = {
  status: 'initializing' | 'ringing' | 'connected' | 'error' | 'ended';
  error?: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
};

type Action =
  | { type: 'SET_STATUS'; payload: CallState['status'] }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'TOGGLE_VIDEO' }
  | { type: 'TOGGLE_SCREEN_SHARE'; payload: boolean }
  | { type: 'RESET' };

const initialState: CallState = {
  status: 'initializing',
  isMuted: false,
  isVideoEnabled: true,
  isScreenSharing: false,
};

function callReducer(state: CallState, action: Action): CallState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload, error: undefined };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload };
    case 'TOGGLE_MUTE':
      return { ...state, isMuted: !state.isMuted };
    case 'TOGGLE_VIDEO':
      return { ...state, isVideoEnabled: !state.isVideoEnabled };
    case 'TOGGLE_SCREEN_SHARE':
      return { ...state, isScreenSharing: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const getStatusMessage = (state: CallState) => {
    switch(state.status) {
        case 'initializing': return 'Initializing...';
        case 'ringing': return 'Ringing...';
        case 'connected': return 'Connected';
        case 'ended': return 'Call ended.';
        case 'error': return state.error || 'An error occurred.';
    }
}

export const LiveCall: React.FC = () => {
    const { friendId } = useParams<{ friendId: string }>();
    const navigate = useNavigate();

    const [state, dispatch] = useReducer(callReducer, initialState);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    
    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const currentCallRef = useRef<Peer.MediaConnection | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const isScreenSharingRef = useRef(state.isScreenSharing);

    useEffect(() => {
        isScreenSharingRef.current = state.isScreenSharing;
    }, [state.isScreenSharing]);

    // --- Core Cleanup Function ---
    const cleanup = useCallback(() => {
        dispatch({ type: 'SET_STATUS', payload: 'ended' });

        localStreamRef.current?.getTracks().forEach(track => track.stop());
        screenStreamRef.current?.getTracks().forEach(track => track.stop());

        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        currentCallRef.current?.close();
        if (peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.destroy();
        }

        localStreamRef.current = null;
        screenStreamRef.current = null;
        currentCallRef.current = null;
        peerRef.current = null;
    }, []);

    const leaveCall = useCallback(() => {
        cleanup();
        navigate(-1);
    }, [navigate, cleanup]);


    // --- Initialization Effect ---
    useEffect(() => {
        const init = async () => {
            try {
                const user = await api.getCurrentUser();
                setCurrentUser(user);

                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                const peer = new Peer(user.id, { debug: 2 });
                peerRef.current = peer;

                const handleCallEvents = (call: Peer.MediaConnection) => {
                    currentCallRef.current = call;
                    call.on('stream', (remoteStream) => {
                        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                        dispatch({ type: 'SET_STATUS', payload: 'connected' });
                    });
                    call.on('close', leaveCall);
                    call.on('error', (err) => {
                        console.error('Call error:', err);
                        dispatch({ type: 'SET_ERROR', payload: 'Call error.' });
                        leaveCall();
                    });
                };

                peer.on('open', () => {
                    if (friendId) {
                        const call = peer.call(friendId, stream);
                        handleCallEvents(call);
                        dispatch({ type: 'SET_STATUS', payload: 'ringing' });
                    }
                });

                peer.on('call', (call) => {
                    call.answer(stream);
                    handleCallEvents(call);
                });

                peer.on('error', (err: any) => {
                    let message = `Error: ${err.message}`;
                    if (err.type === 'peer-unavailable') message = 'User is not available.';
                    if (err.type === 'unavailable-id') message = "Connection ID is taken. Please try again.";
                    dispatch({ type: 'SET_ERROR', payload: message });
                });

                peer.on('disconnected', () => {
                    if (peerRef.current && !peerRef.current.destroyed) {
                         peerRef.current.reconnect();
                    }
                });

            } catch (err: any) {
                const msg = err.name === 'NotAllowedError' ? 'Permissions denied.' : 'Media devices not found.';
                dispatch({ type: 'SET_ERROR', payload: msg });
            }
        };

        init();
        return cleanup; // The one true cleanup function
    }, [friendId, leaveCall, cleanup]);

    // --- Media Controls ---
    const toggleMute = () => {
        localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = state.isMuted);
        dispatch({ type: 'TOGGLE_MUTE' });
    };

    const toggleVideo = () => {
        if (state.isScreenSharing) return;
        localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = state.isVideoEnabled);
        dispatch({ type: 'TOGGLE_VIDEO' });
    };

    const toggleScreenShare = async () => {
        const call = currentCallRef.current;
        if (!call) return;

        const videoSender = call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (!videoSender) return dispatch({ type: 'SET_ERROR', payload: "Could not share screen." });

        if (isScreenSharingRef.current) {
            const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
            if (cameraTrack) {
                await videoSender.replaceTrack(cameraTrack);
                screenStreamRef.current?.getTracks().forEach(track => track.stop());
                screenStreamRef.current = null;
                cameraTrack.enabled = state.isVideoEnabled;
                dispatch({ type: 'TOGGLE_SCREEN_SHARE', payload: false });
            }
        } else {
            try {
                const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = displayStream.getVideoTracks()[0];
                screenStreamRef.current = displayStream;

                const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
                if (cameraTrack) cameraTrack.enabled = false;
                
                await videoSender.replaceTrack(screenTrack);
                dispatch({ type: 'TOGGLE_SCREEN_SHARE', payload: true });

                screenTrack.onended = () => {
                    if (isScreenSharingRef.current && cameraTrack) {
                        videoSender.replaceTrack(cameraTrack);
                        dispatch({ type: 'TOGGLE_SCREEN_SHARE', payload: false });
                        cameraTrack.enabled = state.isVideoEnabled;
                    }
                };
            } catch (err) {
                dispatch({ type: 'SET_ERROR', payload: "Screen share cancelled." });
            }
        }
    };
    
    const getStatusIcon = () => {
        if (state.status === 'error') return <WifiSlash weight="fill" color={DS.Color.Status.Error} />;
        if (state.status === 'connected') return <WifiHigh weight="fill" color="#22c55e" />;
        return <Users weight="thin" />;
    };

    const statusText = getStatusMessage(state);
    const callEstablished = state.status === 'connected';

    return (
        <motion.div
          {...theme.motion.page}
          style={{ 
            ...commonStyles.pageContainer, background: '#000', 
            position: 'fixed', inset: 0, zIndex: 2000,
            flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden'
          }}
        >
            <div style={{ padding: '32px', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
                <div style={{ 
                    background: state.status === 'error' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255,255,255,0.05)', 
                    color: state.status === 'error' ? DS.Color.Status.Error : DS.Color.Base.Content[3],
                    border: `1px solid ${state.status === 'error' ? DS.Color.Status.Error : 'rgba(255,255,255,0.1)'}`,
                    padding: '8px 16px', borderRadius: DS.Radius.Full, display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '12px', backdropFilter: 'blur(10px)',
                }}>
                    {getStatusIcon()} {statusText}
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video ref={remoteVideoRef} autoPlay playsInline style={{ 
                    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                    transition: 'opacity 0.5s ease', opacity: callEstablished ? 1 : 0
                }} />
                
                {!callEstablished && state.status !== 'error' && (
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
                        background: DS.Color.Base.Surface[3], overflow: 'hidden',
                        border: `2px solid ${state.isScreenSharing ? DS.Color.Accent.Surface : 'rgba(255,255,255,0.2)'}`,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)', cursor: 'grab', transition: 'border 0.3s'
                    }} 
                >
                    <video ref={localVideoRef} autoPlay muted playsInline style={{
                        width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)',
                        display: state.isVideoEnabled ? 'block' : 'none'
                    }} />
                    {!state.isVideoEnabled && (
                        <div style={{ ...commonStyles.flexCenter, width: '100%', height: '100%', background: '#000' }}>
                            <span style={{ fontSize: '32px', color: 'white' }}>{currentUser?.username?.charAt(0).toUpperCase()}</span>
                        </div>
                    )}
                </motion.div>
            </div>
            
            <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center', gap: '24px', background: 'linear-gradient(to top, #000 0%, transparent 100%)', zIndex: 10 }}>
                <ControlButton onClick={toggleMute} active={!state.isMuted} icon={state.isMuted ? MicrophoneSlash : Microphone} />
                <ControlButton onClick={toggleVideo} active={state.isVideoEnabled && !state.isScreenSharing} disabled={state.isScreenSharing} icon={state.isVideoEnabled ? VideoCamera : VideoCameraSlash} />
                {isScreenShareSupported && <ControlButton onClick={toggleScreenShare} active={state.isScreenSharing} icon={Screencast} activeColor={DS.Color.Accent.Surface} />}
                
                <motion.button whileTap={{ scale: 0.9 }} onClick={leaveCall}
                   style={{
                       width: '64px', height: '64px', borderRadius: '50%',
                       background: DS.Color.Status.Error, color: '#fff', border: 'none', 
                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                       boxShadow: `0 0 20px rgba(255, 51, 0, 0.4)`, cursor: 'pointer'
                   }}
                >
                    <PhoneDisconnect size={28} weight="fill" />
                </motion.button>
            </div>
        </motion.div>
    );
};

const ControlButton: React.FC<{ onClick: () => void; active: boolean; icon: React.ElementType; disabled?: boolean; activeColor?: string }> = ({ onClick, active, icon: Icon, disabled, activeColor }) => (
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
