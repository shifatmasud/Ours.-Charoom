
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, supabase } from '../../../services/supabaseClient';
import { Message, CurrentUser, Profile } from '../../../types';
import { motion } from 'framer-motion';
import { theme, commonStyles } from '../../../Theme';
import { Lightbox } from '../../Core/Lightbox';
import { ChatHeader, ChatInput, MessageBubble } from './ChatPrimitives';

interface DirectChatProps {
    friendId: string;
}

export const DirectChat: React.FC<DirectChatProps> = ({ friendId }) => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [friendProfile, setFriendProfile] = useState<Profile | null>(null);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<any>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        setTimeout(scrollToBottom, 100);
    }, [messages.length]);

    useEffect(() => {
        const init = async () => {
            try {
                const user = await api.getCurrentUser();
                setCurrentUser(user);

                const [msgs, friend] = await Promise.all([
                    api.getMessages(friendId),
                    api.getUserProfile(friendId)
                ]);
                setMessages(msgs);
                setFriendProfile(friend);

                if (user) {
                    const channelName = `dm-${[user.id, friendId].sort().join('-')}`;
                    const ch = supabase.channel(channelName, {
                        config: { broadcast: { self: true } }
                    });
                    channelRef.current = ch;

                    ch.on('broadcast', { event: 'message' }, ({ payload }) => {
                        const { message, tempId } = payload;
                        
                        setMessages(prev => {
                            if (message.sender_id === user.id && tempId) {
                                return prev.map(m => m.id === tempId ? message : m);
                            }
                            if (message.sender_id !== user.id) {
                                if (prev.find(m => m.id === message.id)) return prev;
                                return [...prev, message];
                            }
                            return prev;
                        });
                    }).subscribe();
                }
            } catch (e) {
                console.error("Failed to initialize chat:", e);
            }
        };

        init();
        
        return () => { 
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [friendId]);

    const handleSend = async (content: string, type: 'text'|'image'|'audio' = 'text', mediaUrl?: string) => {
        if (!currentUser || !channelRef.current) return;
        
        const tempId = `local_${Date.now()}`;
        const optimisticMsg: Message = {
            id: tempId,
            sender_id: currentUser.id,
            receiver_id: friendId,
            content,
            type,
            media_url: mediaUrl,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            await api.sendMessage(channelRef.current, currentUser.id, friendId, content, type, mediaUrl, tempId);
        } catch (e) {
            console.error("Send failed", e);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const startCall = () => {
        if (!currentUser) return;
        const roomId = [currentUser.id, friendId].sort().join('-');
        navigate(`/call/${roomId}`);
    };

    return (
        <>
            <Lightbox isOpen={!!lightboxSrc} src={lightboxSrc || ''} onClose={() => setLightboxSrc(null)} />
            <motion.div 
              {...theme.motion.page}
              style={{ 
                display: 'flex', flexDirection: 'column', height: '100dvh', 
                background: theme.colors.surface1, width: '100%', maxWidth: theme.layout.maxWidth, margin: '0 auto', position: 'relative', overflow: 'hidden'
              }}
            >
                <ChatHeader title={friendProfile?.username || 'Chat'} onCall={startCall} />
                
                <div className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 100px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {messages.length === 0 && (
                       <div style={{ height: '100%', ...commonStyles.flexCenter, flexDirection: 'column', opacity: 0.3, gap: '16px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: `1px solid ${theme.colors.text3}` }}></div>
                          <p style={{ fontSize: '12px', letterSpacing: '2px' }}>Start a conversation</p>
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