
import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, commonStyles, DS } from '../../../Theme';
import { CaretLeft, PhoneCall, PaperPlaneRight, Microphone, Image as ImageIcon, CircleNotch } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { Message } from '../../../types';
import { api } from '../../../services/supabaseClient';
import { Lightbox } from '../../Core/Lightbox';
import { AudioPlayer } from '../../Core/AudioPlayer';

export const ChatHeader: React.FC<{
    title: string;
    onCall?: () => void;
    isCodex?: boolean;
}> = ({ title, onCall, isCodex }) => {
    return (
      <div style={{ 
        padding: '24px', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        background: 'transparent',
        zIndex: 10,
        flexShrink: 0
      }}>
        <Link to="/messages" style={{ color: theme.colors.text1, display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <CaretLeft size={20} color={theme.colors.text3} />
          <span style={{ fontSize: '14px', color: theme.colors.text3 }}>BACK</span>
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
             <motion.span 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               style={{ fontWeight: 600, fontSize: '16px', color: isCodex ? DS.Color.Accent.Surface : theme.colors.text1 }}
              >
                 {title}
             </motion.span>
          
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onCall}
            style={{
              background: theme.colors.surface3,
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.text1,
              cursor: 'pointer'
            }}
          >
            <PhoneCall size={20} weight="fill" />
          </motion.button>
        </div>
      </div>
    );
};

export const MessageBubble: React.FC<{
    msg: Message;
    isMe: boolean;
    onImageClick: (url: string) => void;
}> = ({ msg, isMe, onImageClick }) => {
    // Determine padding based on content type to ensure components fit flush if needed
    const p = msg.type === 'image' || msg.type === 'audio' ? '4px' : '12px 16px';

    return (
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: isMe ? 'flex-end' : 'flex-start',
            marginBottom: '8px',
          }}
        >
          <div 
            style={{ 
              maxWidth: '85%', 
              padding: p, 
              fontSize: '15px', 
              background: isMe ? theme.colors.surface2 : theme.colors.surface3,
              color: theme.colors.text1,
              borderRadius: theme.radius.lg,
              borderBottomRightRadius: isMe ? '4px' : theme.radius.lg,
              borderBottomLeftRadius: isMe ? theme.radius.lg : '4px',
              boxShadow: theme.shadow.card,
              overflow: 'hidden'
            }}
          >
            {msg.type === 'image' ? (
                <img 
                  src={msg.media_url} 
                  alt="attachment" 
                  onClick={() => onImageClick(msg.media_url || '')}
                  style={{ width: '100%', maxWidth: '240px', borderRadius: theme.radius.md, display: 'block', cursor: 'pointer' }} 
                />
            ) : msg.type === 'audio' ? (
                <AudioPlayer src={msg.media_url || ''} />
            ) : (
                msg.content
            )}
          </div>
          {!isMe && (
              <span style={{ fontSize: '10px', color: theme.colors.text3, marginTop: '4px', marginLeft: '4px' }}>
                  {msg.sender_id.slice(0, 8)}...
              </span>
          )}
        </motion.div>
    );
};

export const ChatInput: React.FC<{
    onSend: (content: string, type?: 'text'|'image'|'audio', url?: string) => Promise<void>;
}> = ({ onSend }) => {
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<number | null>(null);

    const handleSendText = async () => {
        if (!newMessage.trim() || isSending) return;
        setIsSending(true);
        await onSend(newMessage);
        setNewMessage('');
        setIsSending(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                setIsSending(true);
                const url = await api.uploadFile(file);
                await onSend("Image", 'image', url);
            } catch (err) {
                console.error(err);
            } finally {
                setIsSending(false);
            }
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
                if (timerRef.current) clearInterval(timerRef.current);
                setRecordingTime(0);
            }
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const recorder = new MediaRecorder(stream);
                mediaRecorderRef.current = recorder;
                audioChunksRef.current = [];
    
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) audioChunksRef.current.push(e.data);
                };
    
                recorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    // Only send if > 0.5s to avoid accidental clicks
                    if (audioBlob.size > 1000) { 
                        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
                        try {
                            setIsSending(true);
                            const url = await api.uploadFile(audioFile);
                            await onSend("Voice Message", 'audio', url);
                        } catch (err) {
                            console.error(err);
                        } finally {
                            setIsSending(false);
                        }
                    }
                    stream.getTracks().forEach(track => track.stop());
                };
    
                recorder.start();
                setIsRecording(true);
                setRecordingTime(0);
                timerRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
            } catch (err) {
                console.error("Mic error", err);
                alert("Could not access microphone.");
            }
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = null; 
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            padding: '0 24px 32px 24px',
            background: `linear-gradient(to top, ${theme.colors.surface1} 60%, transparent 100%)`,
            zIndex: 20
        }}>
          <motion.div 
            layout
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', 
              background: theme.colors.inputBg, 
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: theme.radius.full, 
              padding: '6px 6px 6px 16px', 
              boxShadow: theme.shadow.soft,
              border: `1px solid ${theme.colors.border}`,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Recording Overlay */}
            <AnimatePresence>
                {isRecording && (
                    <motion.div 
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      style={{ 
                          position: 'absolute', inset: 0, background: DS.Color.Base.Surface[2], 
                          zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' 
                      }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <motion.div 
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ repeat: Infinity, duration: 1 }}
                              style={{ width: '12px', height: '12px', borderRadius: '50%', background: DS.Color.Status.Error }}
                            />
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatTime(recordingTime)}</span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button onClick={cancelRecording} style={{ background: 'none', border: 'none', color: theme.colors.text3, cursor: 'pointer' }}>Cancel</button>
                            <button 
                              onClick={toggleRecording} 
                              style={{ 
                                  width: '32px', height: '32px', borderRadius: '50%', background: DS.Color.Accent.Surface, 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: 'white', cursor: 'pointer' 
                              }}>
                                <PaperPlaneRight weight="fill" size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
  
            {/* Media Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: theme.colors.text3, cursor: 'pointer', padding: '6px', display: 'flex' }}>
                   <ImageIcon size={20} />
               </button>
               <input type="file" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} accept="image/*" />
               
               <button 
                  onClick={toggleRecording} 
                  style={{ background: 'none', border: 'none', color: theme.colors.text3, cursor: 'pointer', padding: '6px', display: 'flex' }}
               >
                   <Microphone size={20} />
               </button>
            </div>
  
            <div style={{ width: '1px', height: '20px', background: theme.colors.border }}></div>
  
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSendText();
                  }
              }}
              placeholder="Type something..."
              style={{ 
                ...commonStyles.inputReset, 
                fontSize: '15px', 
                padding: '10px 0',
                color: theme.colors.text1
              }}
            />
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={handleSendText}
              disabled={!newMessage.trim() || isSending}
              style={{ 
                width: '40px', height: '40px', borderRadius: '50%', 
                background: newMessage.trim() ? theme.colors.accent : theme.colors.surface3, 
                color: newMessage.trim() ? 'white' : theme.colors.text3, 
                border: 'none', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', 
                transition: 'all 0.3s ease',
                opacity: isSending ? 0.5 : 1,
                flexShrink: 0
              }}
            >
              {isSending ? <CircleNotch className="animate-spin" /> : <PaperPlaneRight size={18} weight="fill" />}
            </motion.button>
          </motion.div>
        </div>
    );
};
