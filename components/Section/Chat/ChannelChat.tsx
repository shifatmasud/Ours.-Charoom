import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, supabase, parseMessageContent } from '../../../services/supabaseClient';
import { Message, CurrentUser } from '../../../types';
import { motion } from 'framer-motion';
import { theme, commonStyles, DS } from '../../../Theme';
import { Lightbox } from '../../Core/Lightbox';
import { ChatHeader, ChatInput, MessageBubble } from './ChatPrimitives';

import { useAuth } from '../../../contexts/AuthContext';

export const ChannelChat: React.FC = () => {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        setTimeout(scrollToBottom, 100);
    }, [messages.length]);

    useEffect(() => {
        if (!currentUser) return;
        let ignore = false;
        let channel: any = null;

        const init = async () => {
            const msgs = await api.getMessages('codex');
            if (ignore) return;
            setMessages(msgs);

            channel = supabase.channel('public-codex-chat')
               .on('broadcast', { event: 'new_message' }, payload => {
                  const newMsg = parseMessageContent(payload.payload);
                  
                  // Only add messages from other users. My own messages are added optimistically.
                  if (newMsg.sender_id === currentUser.id) {
                    return;
                  }

                  setMessages(prev => {
                      if (prev.find(m => m.id === newMsg.id)) return prev;
                      return [...prev, newMsg];
                  });
               })
               .subscribe();
        };

        init();
        return () => { 
            ignore = true; 
            if(channel) supabase.removeChannel(channel); 
        };
    }, [currentUser]);

    const handleSend = async (content: string, type: 'text'|'image'|'audio' = 'text', mediaUrl?: string) => {
        if (!currentUser) return;

        const tempId = `local_${Date.now()}_${Math.random()}`;
        const optimisticMsg: Message = {
            id: tempId,
            sender_id: currentUser.id,
            receiver_id: 'codex',
            content,
            type,
            media_url: mediaUrl,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const realMsg = await api.sendMessage(currentUser.id, 'codex', content, type, mediaUrl, currentUser.username);
            setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));
        } catch (e) {
            console.error("Failed to send to Codex", e);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const startCall = async () => {
        if (!currentUser) return;
        try {
            await api.sendNotification('codex', currentUser.id, 'call', 'codex-global', undefined, currentUser.username);
        } catch (e) {
            console.error("Failed to send call notification", e);
        }
        navigate(`/call/codex-global`);
    };

    return (
        <>
            {lightboxSrc && <Lightbox isOpen={true} src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
            <motion.div 
              {...theme.motion.page}
              style={{ 
                display: 'flex', flexDirection: 'column', height: '100dvh', 
                background: theme.colors.surface1, width: '100%', maxWidth: theme.layout.maxWidth, margin: '0 auto', position: 'relative', overflow: 'hidden'
              }}
            >
                <ChatHeader title="CODEX" isCodex onCall={startCall} />
                
                <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 100px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {messages.length === 0 && (
                       <div style={{ height: '100%', ...commonStyles.flexCenter, flexDirection: 'column', opacity: 0.3, gap: '16px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: `1px solid ${theme.colors.text3}` }}></div>
                          <p style={{ fontSize: '12px', letterSpacing: '2px' }}>WELCOME TO THE VOID</p>
                       </div>
                    )}
                    
                    {messages.map((msg) => (
                        <MessageBubble 
                            key={msg.id} 
                            msg={msg} 
                            isMe={msg.sender_id === currentUser?.id} 
                            onImageClick={(url) => setLightboxSrc(url)}
                        />
                    ))}
                    <div ref={messagesEndRef} style={{ height: '1px' }} />
                </div>

                <ChatInput onSend={handleSend} />
            </motion.div>
        </>
    );
};
