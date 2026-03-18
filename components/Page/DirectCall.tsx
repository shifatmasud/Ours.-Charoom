import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Room, 
  RoomEvent, 
  ParticipantEvent,
  RemoteParticipant, 
  RemoteTrack, 
  RemoteTrackPublication, 
  Participant, 
  Track,
  VideoTrack,
  LocalVideoTrack,
  LocalAudioTrack,
  createLocalVideoTrack,
  createLocalAudioTrack
} from 'livekit-client';
import { 
  PhoneDisconnect, 
  Microphone, 
  MicrophoneSlash, 
  VideoCamera, 
  VideoCameraSlash,
  User,
  CaretLeft,
  Monitor,
  CaretUp
} from '@phosphor-icons/react';
import { theme, DS, commonStyles } from '../../Theme';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../Core/Loader';

const RemoteVideo: React.FC<{ participant: RemoteParticipant }> = ({ participant }) => {
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [videoTracks, setVideoTracks] = useState<RemoteTrackPublication[]>([]);

  useEffect(() => {
    const updateTracks = () => {
      setVideoTracks(Array.from(participant.videoTracks.values()));
    };

    participant.on(ParticipantEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video) {
        updateTracks();
        const el = videoRefs.current.get(track.sid);
        if (el) track.attach(el);
      }
    });

    participant.on(ParticipantEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Video) {
        updateTracks();
      }
    });

    updateTracks();

    // Initial attach for existing tracks
    participant.videoTracks.forEach(pub => {
      if (pub.track && pub.track.kind === Track.Kind.Video) {
        const el = videoRefs.current.get(pub.track.sid);
        if (el) pub.track.attach(el);
      }
    });

    return () => {
      participant.removeAllListeners();
    };
  }, [participant]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: videoTracks.length > 1 ? '1fr 1fr' : '1fr', height: '100%', width: '100%', background: '#111' }}>
      {videoTracks.map(pub => (
        <div key={pub.trackSid} style={{ position: 'relative', height: '100%', width: '100%' }}>
          <video 
            ref={el => { if (el) videoRefs.current.set(pub.trackSid, el); }}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: '20px', color: '#fff', fontSize: '12px', backdropFilter: 'blur(10px)', zIndex: 10 }}>
            {participant.identity} {pub.source === Track.Source.ScreenShare ? '(Screen)' : ''}
          </div>
        </div>
      ))}
      {videoTracks.length === 0 && (
        <div style={{ ...commonStyles.flexCenter, height: '100%', flexDirection: 'column', gap: '16px', background: '#111' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#222', ...commonStyles.flexCenter }}>
            <User size={30} color="#444" />
          </div>
          <p style={{ color: '#444', fontSize: '12px' }}>{participant.identity} (No Video)</p>
        </div>
      )}
    </div>
  );
};

export const DirectCall: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (!roomId || !currentUser) return;

    const connectToRoom = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Get token from our server
        const response = await fetch(`/api/get-livekit-token?room=${roomId}&identity=${currentUser.username || currentUser.id}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        const { token, serverUrl } = data;

        // 2. Initialize Room
        const wsUrl = import.meta.env.VITE_LIVEKIT_URL || serverUrl;
        
        if (!wsUrl) {
          throw new Error('LiveKit URL is not configured. Please set LIVEKIT_URL in your server environment.');
        }

        const r = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        // 3. Setup Event Listeners
        r.on(RoomEvent.ParticipantConnected, (p) => {
          setRemoteParticipants(prev => [...prev, p]);
        });

        r.on(RoomEvent.ParticipantDisconnected, (p) => {
          setRemoteParticipants(prev => prev.filter(part => part.sid !== p.sid));
        });

        r.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Video) {
            const el = remoteVideoRefs.current.get(participant.sid);
            if (el) track.attach(el);
          } else if (track.kind === Track.Kind.Audio) {
            track.attach();
          }
        });

        r.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          track.detach();
        });

        r.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
          if (publication.track?.kind === Track.Kind.Video && localVideoRef.current) {
            publication.track.attach(localVideoRef.current);
          }
        });

        // 4. Connect
        await r.connect(wsUrl, token);
        setRoom(r);

        // 5. Publish Local Tracks
        await r.localParticipant.enableCameraAndMicrophone();
        
        // Initial attachment if already published
        const videoTrack = r.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
        if (videoTrack && localVideoRef.current) {
          videoTrack.attach(localVideoRef.current);
        }

        setRemoteParticipants(Array.from(r.remoteParticipants.values()));
        setLoading(false);

      } catch (e) {
        console.error('LiveKit connection error:', e);
        setError((e as Error).message);
        setLoading(false);
      }
    };

    connectToRoom();

    return () => {
      room?.disconnect();
    };
  }, [roomId, currentUser]);

  const toggleMute = async () => {
    if (!room) return;
    const enabled = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    setIsMuted(enabled);
  };

  const toggleVideo = async () => {
    if (!room) return;
    const off = !isVideoOff;
    await room.localParticipant.setCameraEnabled(!off);
    setIsVideoOff(off);
  };

  const toggleScreenShare = async () => {
    if (!room) return;
    try {
      const enabled = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(enabled);
      setIsScreenSharing(enabled);
    } catch (e) {
      console.error('Screen share error:', e);
    }
  };

  const endCall = () => {
    room?.disconnect();
    navigate(-1);
  };

  if (loading) return <Loader fullscreen label="CONNECTING TO CALL" />;
  
  if (error) {
    return (
      <div style={{ ...commonStyles.flexCenter, height: '100vh', background: '#000', color: '#fff', flexDirection: 'column', gap: '20px', padding: '40px', textAlign: 'center' }}>
        <p style={{ color: DS.Color.Status.Error, maxWidth: '400px' }}>{error}</p>
        <button onClick={() => navigate(-1)} style={{ padding: '12px 24px', background: DS.Color.Base.Surface[2], border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer' }}>Go Back</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, overflow: 'hidden' }}>
      
      {/* Remote Video (Main View) */}
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {remoteParticipants.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: remoteParticipants.length > 1 ? '1fr 1fr' : '1fr', height: '100%', width: '100%' }}>
            {remoteParticipants.map(p => (
              <RemoteVideo key={p.sid} participant={p} />
            ))}
          </div>
        ) : (
          <div style={{ ...commonStyles.flexCenter, height: '100%', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#222', ...commonStyles.flexCenter }}>
              <User size={40} color="#444" />
            </div>
            <p style={{ color: '#666', fontSize: '14px' }}>Waiting for others to join...</p>
          </div>
        )}
      </div>

      {/* Local Video (PIP) */}
      <motion.div 
        drag
        dragConstraints={containerRef}
        dragElastic={0.1}
        dragMomentum={false}
        style={{ 
          position: 'absolute', 
          bottom: '120px', 
          right: '20px', 
          width: '120px', 
          height: '180px', 
          borderRadius: '16px', 
          overflow: 'hidden', 
          background: '#222',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 100,
          touchAction: 'none'
        }}
      >
        <video 
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
        {isVideoOff && (
          <div style={{ position: 'absolute', inset: 0, background: '#222', ...commonStyles.flexCenter }}>
            <VideoCameraSlash size={24} color="#666" />
          </div>
        )}
      </motion.div>

      {/* Controls */}
      <div style={{ 
        position: 'absolute', 
        bottom: '40px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        display: 'flex', 
        gap: '20px', 
        alignItems: 'center',
        background: 'rgba(255,255,255,0.1)',
        padding: '12px 24px',
        borderRadius: '40px',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        zIndex: 100
      }}>
        <button 
          onClick={toggleMute}
          style={{ 
            width: '48px', height: '48px', borderRadius: '50%', border: 'none', 
            background: isMuted ? DS.Color.Status.Error : 'rgba(255,255,255,0.1)',
            color: '#fff', cursor: 'pointer', ...commonStyles.flexCenter, transition: 'all 0.2s'
          }}
        >
          {isMuted ? <MicrophoneSlash size={20} weight="fill" /> : <Microphone size={20} weight="fill" />}
        </button>

        <button 
          onClick={endCall}
          style={{ 
            width: '64px', height: '64px', borderRadius: '50%', border: 'none', 
            background: DS.Color.Status.Error,
            color: '#fff', cursor: 'pointer', ...commonStyles.flexCenter, transition: 'all 0.2s'
          }}
        >
          <PhoneDisconnect size={28} weight="fill" />
        </button>

        <div style={{ position: 'relative' }}>
          <AnimatePresence>
            {isMediaMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                style={{
                  position: 'absolute',
                  bottom: '70px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: 'rgba(255,255,255,0.1)',
                  padding: '12px',
                  borderRadius: '24px',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <button 
                  onClick={() => { toggleVideo(); setIsMediaMenuOpen(false); }}
                  style={{ 
                    width: '48px', height: '48px', borderRadius: '50%', border: 'none', 
                    background: isVideoOff ? DS.Color.Status.Error : 'rgba(255,255,255,0.1)',
                    color: '#fff', cursor: 'pointer', ...commonStyles.flexCenter, transition: 'all 0.2s'
                  }}
                >
                  {isVideoOff ? <VideoCameraSlash size={20} weight="fill" /> : <VideoCamera size={20} weight="fill" />}
                </button>

                <button 
                  onClick={() => { toggleScreenShare(); setIsMediaMenuOpen(false); }}
                  style={{ 
                    width: '48px', height: '48px', borderRadius: '50%', border: 'none', 
                    background: isScreenSharing ? DS.Color.Accent.Surface : 'rgba(255,255,255,0.1)',
                    color: '#fff', cursor: 'pointer', ...commonStyles.flexCenter, transition: 'all 0.2s'
                  }}
                >
                  <Monitor size={20} weight={isScreenSharing ? "fill" : "regular"} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={() => setIsMediaMenuOpen(!isMediaMenuOpen)}
            style={{ 
              width: '48px', height: '48px', borderRadius: '50%', border: 'none', 
              background: isMediaMenuOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
              color: '#fff', cursor: 'pointer', ...commonStyles.flexCenter, transition: 'all 0.2s'
            }}
          >
            <motion.div animate={{ rotate: isMediaMenuOpen ? 180 : 0 }}>
              <CaretUp size={20} weight="bold" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        style={{ 
          position: 'absolute', top: '40px', left: '20px', 
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', 
          padding: '8px 16px', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(10px)',
          zIndex: 100
        }}
      >
        <CaretLeft size={18} /> Exit
      </button>

    </div>
  );
};
