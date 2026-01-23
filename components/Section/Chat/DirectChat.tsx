
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, supabase, parseMessageContent } from '../../../services/supabaseClient';
import { Message, CurrentUser } from '../../../types';
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
    const [friendProfile, setFriendProfile] = useState<any>(null);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        setTimeout(scrollToBottom, 100);
    }, [messages.length]);

    useEffect(() => {
        let ignore = false;
        let channel: any = null;

        const init = async () => {
            const user = await api.getCurrentUser();
            if (ignore) return;
            setCurrentUser(user);

            // Fetch Messages
            const msgs = await api.getMessages(friendId);
            if (ignore) return;
            setMessages(msgs);

            const friend = (await api.getAllProfiles()).find(p => p.id === friendId);
            if (ignore) return;
            setFriendProfile(friend);

            // Subscribe to DM updates
            // We listen to the messages table and filter manually since complex OR filters are hard in realtime syntax
            channel = supabase.channel(`dm:${user.id}:${friendId}`)
               .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                   const msgRaw = payload.new;
                   const msg = parseMessageContent(msgRaw);
                   
                   // Filter for relevant messages (me->friend OR friend->me)
                   if ((msg.sender_id === user.id && msg.receiver_id === friendId) || 
                       (msg.sender_id === friendId && msg.receiver_id === user.id)) {
                        setMessages(prev => {
                           if (prev.find(m => m.id === msg.id)) return prev;
                           return [...prev, msg];
                        });
                   }
               })
               .subscribe();
        };

        init();
        return () => { 
            ignore = true; 
            if(channel) supabase.removeChannel(channel); 
        };
    }, [friendId]);

    const handleSend = async (content: string, type: 'text'|'image'|'audio' = 'text', mediaUrl?: string) => {
        if (!currentUser) return;
        
        // Optimistic UI Update with local ID
        const tempId = `local_${Date.now()}_${Math.random()}`;
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
            await api.sendMessage(currentUser.id, friendId, content, type, mediaUrl);
        } catch (e) {
            console.error("Send failed", e);
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
