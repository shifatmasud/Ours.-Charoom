
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, Participant, Track } from 'livekit-client';
import { Microphone, MicrophoneSlash, PhoneDisconnect, VideoCamera, VideoCameraSlash, WifiHigh, WifiSlash, WarningCircle } from '@phosphor-icons/react';
import { theme, commonStyles } from '../../Theme';
import { api } from '../../services/supabaseClient';

// --- LiveKit Configuration ---
// NOTE: This uses LiveKit's public demo server. For a production app, you should host your own
// LiveKit instance or use LiveKit Cloud (https://cloud.livekit.io).
const LIVEKIT_URL = 'wss://livekit-examples.livekit.io';

/**
 * --- IMPORTANT: Token Generation ---
 * In a real application, this token MUST be generated on a secure server using your
 * LiveKit API Key and Secret. Exposing keys on the client-side is a major security risk.
 * We are using a public demo endpoint here strictly for demonstration purposes.
 *
 * Backend (Node.js) example:
 *
 * import { AccessToken } from 'livekit-server-sdk';
 *
 * const at = new AccessToken('API_KEY', 'API_SECRET', {
 *   identity: participantName,
 * });
 * at.addGrant({ roomJoin: true, room: roomName });
 * const token = at.toJwt();
 * // then send `token` to the client
 */
const getToken = async (roomName: string, participantName: string): Promise<string> => {
    const response = await fetch(`https://livekit-examples.livekit.io/api/token?roomName=${roomName}&identity=${participantName}`);
    const data = await response.json();
    return data.token;
};


export const LiveCall: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();

    const [status, setStatus] = useState('Initializing...');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [remoteParticipant, setRemoteParticipant] = useState<RemoteParticipant | null>(null);

    const roomRef = useRef<Room | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const leaveCall = async () => {
        await roomRef.current?.disconnect();
        navigate(-1);
    };

    useEffect(() => {
        const connect = async () => {
            if (!roomId) return;
            
            try {
                const user = await api.getCurrentUser();
                setStatus('Requesting token...');
                const token = await getToken(roomId, user.id);

                const room = new Room({
                    serverUrl: LIVEKIT_URL,
                    publishDefaults: {
                        videoCodec: 'vp9',
                    }
                });
                roomRef.current = room;

                // --- Room Event Handlers ---
                const onTrackSubscribed = (track: Track, participant: RemoteParticipant) => {
                    if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
                        track.attach(remoteVideoRef.current);
                        setRemoteParticipant(participant);
                    }
                };

                const onParticipantConnected = (participant: RemoteParticipant) => {
                    setRemoteParticipant(participant);
                    setStatus('Peer connected.');
                };

                const onParticipantDisconnected = () => {
                    setRemoteParticipant(null);
                    setStatus('Peer has left the call.');
                    setTimeout(() => leaveCall(), 2000);
                };

                room
                  .on(RoomEvent.ParticipantConnected, onParticipantConnected)
                  .on(RoomEvent.TrackSubscribed, onTrackSubscribed)
                  .on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
                  .on(RoomEvent.Disconnected, leaveCall)
                  .on(RoomEvent.Reconnecting, () => setStatus('Reconnecting...'))
                  .on(RoomEvent.Reconnected, () => setStatus('Connection restored.'));

                setStatus('Connecting to room...');
                await room.connect(LIVEKIT_URL, token);
                
                // Set up local media
                await room.localParticipant.enableCameraAndMicrophone();
                const localVideoTrack = room.localParticipant.getTrack(Track.Source.Camera)?.publication.track;
                if (localVideoTrack && localVideoRef.current) {
                    localVideoTrack.attach(localVideoRef.current);
                }

                // If a participant is already here, set them
                if (room.remoteParticipants.size > 0) {
                     const p = room.remoteParticipants.values().next().value;
                     setRemoteParticipant(p);
                     setStatus('Connected');
                } else {
                     setStatus('Waiting for peer...');
                }

            } catch (error) {
                console.error("Error connecting to LiveKit", error);
                setStatus('Error: Could not connect to the call.');
            }
        };

        connect();

        return () => {
            roomRef.current?.disconnect();
        };
    }, [roomId]);

    const toggleMute = async () => {
        if (!roomRef.current) return;
        const isMuted = roomRef.current.localParticipant.isMicrophoneEnabled;
        await roomRef.current.localParticipant.setMicrophoneEnabled(!isMuted);
        setIsMuted(isMuted);
    };

    const toggleVideo = async () => {
        if (!roomRef.current) return;
        const isEnabled = roomRef.current.localParticipant.isCameraEnabled;
        await roomRef.current.localParticipant.setCameraEnabled(!isEnabled);
        setIsVideoEnabled(!isEnabled);
    };
    
    const isError = status.startsWith('Error:');
    const isConnected = roomRef.current?.state === 'connected';

    const getStatusIcon = () => {
        if (isError) return <WifiSlash weight="fill" color={theme.colors.danger} />;
        if (isConnected) return <WifiHigh weight="fill" color="#22c55e" />;
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
                    background: isError ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255,255,255,0.05)', 
                    color: isError ? theme.colors.danger : theme.colors.text3,
                    border: `1px solid ${isError ? theme.colors.danger : 'rgba(255,255,255,0.1)'}`,
                    padding: '8px 16px', borderRadius: theme.radius.full,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '12px', backdropFilter: 'blur(10px)',
                }}>
                    {getStatusIcon()}
                    {status}
                </div>
            </div>

            {/* Video Area */}
            <div style={{ flex: 1, position: 'relative' }}>
                {/* Remote Video (Fullscreen) */}
                <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                
                {/* Local Video (Picture-in-Picture) */}
                <motion.video 
                    drag
                    dragConstraints={{ top: -200, left: -200, right: 200, bottom: 200 }}
                    ref={localVideoRef} autoPlay muted playsInline 
                    style={{
                        position: 'absolute',
                        bottom: '140px',
                        right: '24px',
                        width: '120px',
                        height: '180px',
                        borderRadius: '16px',
                        objectFit: 'cover',
                        border: `2px solid rgba(255,255,255,0.2)`,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        cursor: 'grab'
                    }} 
                />
            </div>
            
            {/* Controls */}
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
            backdropFilter: 'blur(10px)', 
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s'
        }}
    >
        <Icon size={24} weight="fill" />
    </motion.button>
);
