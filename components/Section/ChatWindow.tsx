
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CaretLeft, PaperPlaneRight, PhoneCall } from '@phosphor-icons/react';
import { api, supabase } from '../../services/supabaseClient';
import { Message, CurrentUser } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, commonStyles } from '../../Theme';

export const ChatWindow: React.FC = () => {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);
  
  // Lock to prevent duplicate submission in race conditions
  const sendingLock = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Initial scroll with slight delay to allow layout render
    setTimeout(scrollToBottom, 100);
  }, [messages.length]); // Only scroll when count changes

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      const user = await api.getCurrentUser();
      if (!ignore) setCurrentUser(user);
      if (friendId) {
        const msgs = await api.getMessages(friendId);
        if (!ignore) setMessages(msgs);
        const friend = (await api.getAllProfiles()).find(p => p.id === friendId);
        if (!ignore) setFriendProfile(friend);
      }
    };
    init();
    return () => { ignore = true; };
  }, [friendId]);

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUser || !friendId || sendingLock.current) return;
    
    const text = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    sendingLock.current = true;
    
    try {
      // Optimistic ID to track this specific message
      const tempId = `local_${Date.now()}_${Math.random()}`;
      
      const optimisticMsg: Message = {
        id: tempId,
        sender_id: currentUser.id,
        receiver_id: friendId,
        content: text,
        created_at: new Date().toISOString()
      };

      // Optimistic Update with Deduplication Guard
      setMessages(prev => {
        // 1. Check for ID duplication (prevents strict mode double-add)
        if (prev.some(m => m.id === tempId)) return prev;
        
        // 2. Duplicate content check for rapid-fire safety (debounce 1 sec)
        if (prev.length > 0) {
             const last = prev[prev.length - 1];
             const timeDiff = new Date().getTime() - new Date(last.created_at).getTime();
             if (last.sender_id === currentUser.id && last.content === text && timeDiff < 1000) {
                 return prev;
             }
        }
        return [...prev, optimisticMsg];
      });

      await api.sendMessage(currentUser.id, friendId, text);
      
    } catch (e) {
      console.error("Failed to send", e);
    } finally {
        setIsSending(false);
        sendingLock.current = false;
        setTimeout(scrollToBottom, 50);
    }
  };

  const startCall = () => {
      if (!currentUser || !friendId) return;
      const roomId = [currentUser.id, friendId].sort().join('-');
      navigate(`/call/${roomId}`);
  };

  return (
    <motion.div 
      {...theme.motion.page}
      style={{ 
        display: 'flex', flexDirection: 'column', height: '100dvh', 
        background: theme.colors.surface1, width: '100%', maxWidth: theme.layout.maxWidth, margin: '0 auto', position: 'relative', overflow: 'hidden'
      }}
    >
      
      {/* Ultra Minimal Header */}
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
               style={{ fontWeight: 600, fontSize: '16px', color: theme.colors.text1 }}
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

      {/* Messages Area - Airy */}
      <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 100px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
           <div style={{ height: '100%', ...commonStyles.flexCenter, flexDirection: 'column', opacity: 0.3, gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: `1px solid ${theme.colors.text3}` }}></div>
              <p style={{ fontSize: '12px', letterSpacing: '2px' }}>VOID</p>
           </div>
        )}
        
        {/* AnimatePresence can cause jumps, careful use here */}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser?.id;
          const isLast = i === messages.length - 1;
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              key={msg.id} 
              style={{ 
                display: 'flex', 
                justifyContent: isMe ? 'flex-end' : 'flex-start',
                marginBottom: isLast ? '0' : '8px',
                transformOrigin: isMe ? 'bottom right' : 'bottom left'
              }}
            >
              <div 
                style={{ 
                  maxWidth: '80%', 
                  padding: '12px 16px', 
                  fontSize: '15px', 
                  fontWeight: 400, 
                  lineHeight: 1.5,
                  background: isMe ? theme.colors.surface2 : theme.colors.surface3,
                  color: theme.colors.text1, // Ensuring high contrast
                  borderRadius: theme.radius.lg,
                  borderBottomRightRadius: isMe ? '4px' : theme.radius.lg,
                  borderBottomLeftRadius: isMe ? theme.radius.lg : '4px',
                  boxShadow: theme.shadow.card
                }}
              >
                {msg.content}
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>

      {/* Input Area - Fixed to bottom to ensure visibility */}
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
            padding: '6px 6px 6px 20px', 
            boxShadow: theme.shadow.soft,
            border: `1px solid ${theme.colors.border}`
          }}
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault(); // Prevent form submission default if any
                    handleSend();
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
            onClick={handleSend}
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
            <PaperPlaneRight size={18} weight="fill" />
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};