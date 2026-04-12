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

const VideoTrackView: React.FC<{ trackPublication: RemoteTrackPublication; participant: RemoteParticipant }> = ({ trackPublication, participant }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const attachTrack = () => {
      if (trackPublication.track) {
        console.log(`VideoTrackView: Attaching track ${trackPublication.trackSid} from ${participant.identity}`);
        const track = trackPublication.track as RemoteTrack;
        track.attach(el);
      }
    };

    attachTrack();

    return () => {
      if (trackPublication.track && el) {
        (trackPublication.track as RemoteTrack).detach(el);
      }
    };
  }, [trackPublication.track, participant.sid]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', background: '#111' }}>
      {trackPublication.track ? (
        <video 
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ ...commonStyles.flexCenter, height: '100%', flexDirection: 'column', gap: '16px' }}>
          <Loader label="Connecting video..." />
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: '20px', color: '#fff', fontSize: '12px', backdropFilter: 'blur(10px)', zIndex: 10 }}>
        {participant.identity} {trackPublication.source === Track.Source.ScreenShare ? '(Screen)' : ''}
      </div>
    </div>
  );
};

const RemoteVideo: React.FC<{ participant: RemoteParticipant }> = ({ participant }) => {
  const [videoTracks, setVideoTracks] = useState<RemoteTrackPublication[]>([]);

  useEffect(() => {
    if (!participant) return;
    const updateTracks = () => {
      const tracks = participant.videoTracks ? Array.from(participant.videoTracks.values()) : [];
      console.log(`RemoteVideo: Updating tracks for ${participant.identity}. Found ${tracks.length} video-kind tracks.`);
      setVideoTracks(tracks.filter((p: RemoteTrackPublication) => p.kind === Track.Kind.Video));
    };

    participant.on(ParticipantEvent.TrackSubscribed, updateTracks);
    participant.on(ParticipantEvent.TrackUnsubscribed, updateTracks);
    participant.on(ParticipantEvent.TrackPublished, updateTracks);
    participant.on(ParticipantEvent.TrackUnpublished, updateTracks);

    updateTracks();

    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, updateTracks);
      participant.off(ParticipantEvent.TrackUnsubscribed, updateTracks);
      participant.off(ParticipantEvent.TrackPublished, updateTracks);
      participant.off(ParticipantEvent.TrackUnpublished, updateTracks);
    };
  }, [participant]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: videoTracks.length > 1 ? '1fr 1fr' : '1fr', height: '100%', width: '100%', background: '#111' }}>
      {videoTracks.map(pub => (
        <VideoTrackView key={pub.trackSid} trackPublication={pub} participant={participant} />
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
  
  const roomRef = useRef<Room | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);

  // Handle local video attachment
  useEffect(() => {
    const attachLocal = async () => {
      if (localVideoRef.current && localVideoTrackRef.current && !isVideoOff) {
        console.log('DirectCall: Attaching local video track');
        localVideoTrackRef.current.attach(localVideoRef.current);
      }
    };
    attachLocal();
  }, [loading, isVideoOff, localVideoTrackRef.current]);

  useEffect(() => {
    if (!roomId || !currentUser) return;
    let isMounted = true;

    const connectToRoom = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Create local audio track first
        try {
          localAudioTrackRef.current = await createLocalAudioTrack();
        } catch (trackError) {
          console.warn('Could not acquire audio device:', trackError);
        }

        if (!isMounted) return;

        // 2. Get token from our server
        let roomName = roomId || '';
        if (roomName === '00000000-0000-0000-0000-000000000000' || roomName === 'codex-global') {
          roomName = 'global-call-room';
        } else if (roomName && !roomName.includes(currentUser.id)) {
          // If roomId is just the friend's ID (legacy or direct navigation), construct the composite room name
          roomName = [currentUser.id, roomName].sort().join('-');
        }
        
        console.log(`DirectCall: Connecting to room "${roomName}" with identity "${currentUser.username || currentUser.id}"`);
          
        const identity = currentUser.username || currentUser.id;
        const response = await fetch(`/api/get-livekit-token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`);
        
        if (!isMounted) return;

        // Handle non-JSON responses (e.g. 500 errors from Vercel)
        if (!response.ok) {
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            throw new Error(data.error || 'Failed to get token');
          } catch (e) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }
        }
        
        const data = await response.json();
        if (!isMounted) return;
        
        if (data.error) throw new Error(data.error);
        const { token, serverUrl } = data;

        // 3. Initialize Room
        const wsUrl = import.meta.env.VITE_LIVEKIT_URL || serverUrl;
        
        if (!wsUrl) {
          throw new Error('LiveKit URL is not configured.');
        }

        const r = new Room({
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            simulcast: true,
          }
        });

        roomRef.current = r;

        // 4. Setup Event Listeners
        r.on(RoomEvent.ParticipantConnected, (p) => {
          console.log(`DirectCall: Participant connected: ${p.identity} (${p.sid})`);
          if (isMounted) setRemoteParticipants(prev => [...prev, p]);
        });

        r.on(RoomEvent.ParticipantDisconnected, (p) => {
          console.log(`DirectCall: Participant disconnected: ${p.identity} (${p.sid})`);
          if (isMounted) setRemoteParticipants(prev => prev.filter(part => part.sid !== p.sid));
        });

        r.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log(`DirectCall: Track subscribed: ${track.kind} from ${participant.identity}`);
          if (track.kind === Track.Kind.Audio) {
            track.attach();
          }
          // Force a refresh of remote participants to ensure UI picks up the new track
          if (isMounted) setRemoteParticipants(Array.from(r.remoteParticipants.values()));
        });

        r.on(RoomEvent.ConnectionStateChanged, (state) => {
          console.log(`DirectCall: Connection state changed: ${state}`);
        });

        r.localParticipant.on(ParticipantEvent.LocalTrackPublished, (pub) => {
          console.log(`DirectCall: Local track published: ${pub.kind} (${pub.source})`);
          if (pub.source === Track.Source.Camera && pub.track) {
            localVideoTrackRef.current = pub.track as LocalVideoTrack;
            // Force re-render to trigger the attachment useEffect
            setIsVideoOff(false); 
            if (localVideoRef.current) {
              pub.track.attach(localVideoRef.current);
            }
          }
        });

        r.localParticipant.on(ParticipantEvent.LocalTrackUnpublished, (pub) => {
          console.log(`DirectCall: Local track unpublished: ${pub.kind} (${pub.source})`);
          if (pub.source === Track.Source.Camera) {
            if (localVideoRef.current && localVideoTrackRef.current) {
              localVideoTrackRef.current.detach(localVideoRef.current);
            }
            localVideoTrackRef.current = null;
          }
        });

        // 5. Connect
        console.log(`DirectCall: Connecting to LiveKit at ${wsUrl}...`);
        await r.connect(wsUrl, token);
        
        if (!isMounted) {
          r.disconnect();
          return;
        }

        console.log('DirectCall: Connected to room successfully');
        setRoom(r);

        // 6. Publish Local Audio Track with a small delay
        setTimeout(async () => {
          if (!isMounted || roomRef.current?.state !== 'connected') return;
          try {
            if (localAudioTrackRef.current) await roomRef.current.localParticipant.publishTrack(localAudioTrackRef.current);
            
            // If user somehow enabled video during connection, enable it now
            if (!isVideoOff) {
              await roomRef.current.localParticipant.setCameraEnabled(true);
            }
          } catch (pubError) {
            console.error('Failed to publish initial tracks:', pubError);
          }
        }, 1000);

        const participants = r.remoteParticipants ? Array.from(r.remoteParticipants.values()) : [];
        setRemoteParticipants(participants);
        setLoading(false);

      } catch (e) {
        if (!isMounted) return;
        console.error('LiveKit connection error:', e);
        setError((e as Error).message);
        setLoading(false);
        
        // Cleanup on error
        localVideoTrackRef.current?.stop();
        localAudioTrackRef.current?.stop();
        localVideoTrackRef.current = null;
        localAudioTrackRef.current = null;
      }
    };

    connectToRoom();

    return () => {
      isMounted = false;
      roomRef.current?.disconnect();
      roomRef.current = null;
      localVideoTrackRef.current?.stop();
      localAudioTrackRef.current?.stop();
      localVideoTrackRef.current = null;
      localAudioTrackRef.current = null;
    };
  }, [roomId, currentUser]);

  const toggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    
    if (room && room.state === 'connected') {
      try {
        await room.localParticipant.setMicrophoneEnabled(!nextMuted);
      } catch (e) {
        console.error('Failed to toggle microphone:', e);
      }
    } else if (localAudioTrackRef.current) {
      try {
        // Use setEnabled if available, otherwise fallback to direct property access
        if (typeof localAudioTrackRef.current.setEnabled === 'function') {
          await localAudioTrackRef.current.setEnabled(!nextMuted);
        } else {
          // @ts-ignore - fallback for unexpected track objects
          localAudioTrackRef.current.enabled = !nextMuted;
        }
      } catch (e) {
        console.error('Failed to toggle local audio track:', e);
      }
    }
  };

  const toggleVideo = async () => {
    const nextVideoOff = !isVideoOff;
    console.log(`DirectCall: Toggling video to ${!nextVideoOff ? 'ON' : 'OFF'}`);
    setIsVideoOff(nextVideoOff);
    
    if (room && room.state === 'connected') {
      try {
        await room.localParticipant.setCameraEnabled(!nextVideoOff);
        console.log(`DirectCall: Camera enabled state set to ${!nextVideoOff}`);
      } catch (e) {
        console.error('Failed to toggle camera:', e);
        setIsVideoOff(!nextVideoOff); // Rollback
      }
    } else if (localVideoTrackRef.current) {
      try {
        // Use setEnabled if available, otherwise fallback to direct property access
        if (typeof localVideoTrackRef.current.setEnabled === 'function') {
          await localVideoTrackRef.current.setEnabled(!nextVideoOff);
        } else {
          // @ts-ignore - fallback for unexpected track objects
          localVideoTrackRef.current.enabled = !nextVideoOff;
        }
      } catch (e) {
        console.error('Failed to toggle local video track:', e);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!room || room.state !== 'connected') return;
    
    // Check support
    if (!navigator.mediaDevices || !('getDisplayMedia' in navigator.mediaDevices)) {
      setError("Screen sharing is not supported in this browser.");
      return;
    }

    try {
      const enabled = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(enabled);
      setIsScreenSharing(enabled);
    } catch (e) {
      console.error('Screen share error:', e);
      setError("Failed to share screen. Please ensure you have granted permission.");
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
        <p style={{ color: DS.Color.Status.Error, maxWidth: '400px', fontSize: '14px' }}>{error}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '12px 24px', background: DS.Color.Accent.Surface, border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            Retry Connection
          </button>
          <button 
            onClick={() => navigate(-1)} 
            style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer' }}
          >
            Go Back
          </button>
        </div>
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
          <div style={{ ...commonStyles.flexCenter, height: '100%', flexDirection: 'column', gap: '24px', background: '#000' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#111', ...commonStyles.flexCenter, border: '1px solid rgba(255,255,255,0.05)' }}>
              <User size={48} color="#333" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Waiting for others...</p>
              <p style={{ color: '#666', fontSize: '14px' }}>The call will start as soon as they join</p>
            </div>
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

      {/* Media Menu (Moved outside to fix backdrop-filter issues) */}
      <AnimatePresence>
        {isMediaMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
            style={{
              position: 'absolute',
              bottom: '140px',
              left: '50%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.12)',
              padding: '12px',
              borderRadius: '24px',
              backdropFilter: DS.Effect.Blur.Frosted,
              WebkitBackdropFilter: DS.Effect.Blur.Frosted,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              zIndex: 101,
              transformStyle: 'preserve-3d',
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

      {/* Controls */}
      <div style={{ 
        position: 'absolute', 
        bottom: '40px', 
        left: '50%', 
        transform: 'translateX(-50%) translateZ(0)', 
        display: 'flex', 
        gap: '20px', 
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.12)',
        padding: '12px 24px',
        borderRadius: '40px',
        backdropFilter: DS.Effect.Blur.Frosted,
        WebkitBackdropFilter: DS.Effect.Blur.Frosted,
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        zIndex: 100,
        isolation: 'isolate'
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
          background: 'rgba(255, 255, 255, 0.12)', borderRadius: '12px', 
          padding: '8px 16px', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px', 
          backdropFilter: DS.Effect.Blur.Frosted,
          WebkitBackdropFilter: DS.Effect.Blur.Frosted,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          zIndex: 100,
          transform: 'translateZ(0)',
          isolation: 'isolate'
        }}
      >
        <CaretLeft size={18} /> Exit
      </button>

    </div>
  );
};
