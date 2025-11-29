
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CaretLeft, PaperPlaneRight, PhoneCall, Image as ImageIcon, Microphone, StopCircle, Trash, Waveform } from '@phosphor-icons/react';
import { api, supabase } from '../../services/supabaseClient';
import { Message, CurrentUser } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, commonStyles, DS } from '../../Theme';
import { CircleNotch } from '@phosphor-icons/react';

export const ChatWindow: React.FC = () => {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);
  
  // Media States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendingLock = useRef(false);
  const timerRef = useRef<number | null>(null);

  const isCodex = friendId === 'codex';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [messages.length]);

  useEffect(() => {
    let ignore = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const user = await api.getCurrentUser();
      if (ignore) return;
      setCurrentUser(user);
      
      if (friendId) {
        if (friendId === 'codex') {
             setFriendProfile({ username: 'CODEX', avatar_url: 'https://picsum.photos/seed/codex/100/100', id: 'codex' });
             const msgs = await api.getMessages('codex');
             if (ignore) return;
             setMessages(msgs);
             
             // Setup realtime subscription for codex
             // Important: Assign the channel subscription to the local variable for cleanup
             channel = supabase.channel('codex_chat_v2')
               .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'receiver_id=eq.codex' }, payload => {
                  setMessages(prev => {
                      // Prevent duplicates
                      if (prev.find(m => m.id === payload.new.id)) return prev;
                      return [...prev, payload.new as Message];
                  });
               })
               .subscribe();
               
        } else {
             const msgs = await api.getMessages(friendId);
             if (ignore) return;
             setMessages(msgs);
             const friend = (await api.getAllProfiles()).find(p => p.id === friendId);
             if (ignore) return;
             setFriendProfile(friend);
        }
      }
    };
    init();

    return () => { 
        ignore = true; 
        if (channel) {
            supabase.removeChannel(channel);
        }
    };
  }, [friendId]);

  const handleSend = async (content: string, type: 'text'|'image'|'audio' = 'text', mediaUrl?: string) => {
    if ((!content.trim() && !mediaUrl) || !currentUser || !friendId || sendingLock.current) return;
    
    setNewMessage('');
    setIsSending(true);
    sendingLock.current = true;
    
    try {
      const tempId = `local_${Date.now()}_${Math.random()}`;
      const optimisticMsg: Message = {
        id: tempId,
        sender_id: currentUser.id,
        receiver_id: friendId,
        content: content,
        type: type,
        media_url: mediaUrl,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, optimisticMsg]);
      await api.sendMessage(currentUser.id, friendId, content, type, mediaUrl);
      
    } catch (e) {
      console.error("Failed to send", e);
    } finally {
        setIsSending(false);
        sendingLock.current = false;
        setTimeout(scrollToBottom, 50);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          try {
              setIsSending(true);
              const url = await api.uploadFile(file);
              await handleSend("Image", 'image', url);
          } catch (err) {
              console.error(err);
              setIsSending(false);
          }
      }
  };

  const toggleRecording = async () => {
    if (isRecording) {
        // Stop
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            setRecordingTime(0);
        }
    } else {
        // Start
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                // If duration was too short, maybe cancel? For now just send.
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size > 1000) { // arbitrary small size check
                    const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
                    try {
                        const url = await api.uploadFile(audioFile);
                        await handleSend("Voice Message", 'audio', url);
                    } catch (err) {
                        console.error(err);
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
          mediaRecorderRef.current.onstop = null; // Prevent sending
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
  };

  const startCall = () => {
      if (!currentUser || !friendId) return;
      // For codex, use a fixed room ID. For DM, sort IDs.
      const roomId = isCodex ? 'codex-global' : [currentUser.id, friendId].sort().join('-');
      navigate(`/call/${roomId}`);
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      {...theme.motion.page}
      style={{ 
        display: 'flex', flexDirection: 'column', height: '100dvh', 
        background: theme.colors.surface1, width: '100%', maxWidth: theme.layout.maxWidth, margin: '0 auto', position: 'relative', overflow: 'hidden'
      }}
    >
      
      {/* Header */}
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
          {friendProfile && (
             <motion.span 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               style={{ fontWeight: 600, fontSize: '16px', color: isCodex ? DS.Color.Accent.Surface : theme.colors.text1 }}
              >
                 {friendProfile.username}
             </motion.span>
          )}
          
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={startCall}
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

      {/* Messages Area */}
      <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 100px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
           <div style={{ height: '100%', ...commonStyles.flexCenter, flexDirection: 'column', opacity: 0.3, gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: `1px solid ${theme.colors.text3}` }}></div>
              <p style={{ fontSize: '12px', letterSpacing: '2px' }}>{isCodex ? 'WELCOME TO THE VOID' : 'VOID'}</p>
           </div>
        )}
        
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser?.id;
          const isLast = i === messages.length - 1;
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={msg.id} 
              style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
                marginBottom: isLast ? '0' : '8px',
              }}
            >
              <div 
                style={{ 
                  maxWidth: '80%', 
                  padding: msg.type === 'image' ? '4px' : '12px 16px', 
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
                    <img src={msg.media_url} alt="attachment" style={{ width: '100%', maxWidth: '200px', borderRadius: theme.radius.md, display: 'block' }} />
                ) : msg.type === 'audio' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
                        <audio controls src={msg.media_url} style={{ height: '30px', width: '200px', filter: 'invert(1) grayscale(1)' }} />
                    </div>
                ) : (
                    msg.content
                )}
              </div>
              {isCodex && !isMe && (
                  <span style={{ fontSize: '10px', color: theme.colors.text3, marginTop: '4px', marginLeft: '4px' }}>
                      {msg.sender_id}
                  </span>
              )}
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>

      {/* Input Area */}
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
                    handleSend(newMessage);
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
            onClick={() => handleSend(newMessage)}
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
    </motion.div>
  );
};
