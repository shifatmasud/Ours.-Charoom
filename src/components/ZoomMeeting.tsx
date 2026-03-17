
import React, { useEffect, useRef, useState } from 'react';
import { zoomService } from '../services/zoomService';
import { VideoQuality } from '@zoom/videosdk';

interface ZoomMeetingProps {
  sessionName: string;
  token: string;
  userName: string;
}

export const ZoomMeeting: React.FC<ZoomMeetingProps> = ({ sessionName, token, userName }) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isInSession, setIsInSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    try {
      await zoomService.joinSession(sessionName, token, userName);
      setIsInSession(true);
      
      const client = zoomService.getClient();
      const stream = client.getMediaStream();
      
      // Start video
      if (videoContainerRef.current) {
        await stream.startVideo();
        // Render local video
        await stream.renderVideo(
          videoContainerRef.current,
          client.getCurrentUserInfo().userId,
          640,
          360,
          0,
          0,
          VideoQuality.Video_360P
        );
      }
    } catch (err: any) {
      console.error('Failed to join Zoom session:', err);
      setError(err.message || 'Failed to join session');
    }
  };

  const leave = async () => {
    try {
      await zoomService.leaveSession();
      setIsInSession(false);
    } catch (err) {
      console.error('Failed to leave Zoom session:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (isInSession) {
        leave();
      }
    };
  }, [isInSession]);

  return (
    <div className="flex flex-col items-center p-4 bg-zinc-900 rounded-2xl border border-white/10">
      <h2 className="text-xl font-semibold mb-4 text-white">Zoom Video Session</h2>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div 
        ref={videoContainerRef} 
        className="w-full aspect-video bg-black rounded-xl overflow-hidden mb-4"
        id="video-container"
      />

      <div className="flex gap-4">
        {!isInSession ? (
          <button
            onClick={join}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-medium transition-colors"
          >
            Join Session
          </button>
        ) : (
          <button
            onClick={leave}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-colors"
          >
            Leave Session
          </button>
        )}
      </div>
      
      <p className="mt-4 text-xs text-zinc-500">
        Session: {sessionName} | User: {userName}
      </p>
    </div>
  );
};
