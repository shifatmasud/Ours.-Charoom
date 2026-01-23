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
            if (ignore || !user) return;
            setCurrentUser(user);

            const [msgs, allProfiles] = await Promise.all([
                api.getMessages(friendId),
                api.getAllProfiles()
            ]);

            if (ignore) return;
            setMessages(msgs);
            setFriendProfile(allProfiles.find(p => p.id === friendId));

            // --- Realtime Subscription ---
            // The provided DB schema lacks a `room_id`, which the backend trigger needs for private channels.
            // WORKAROUND: We listen to all public changes on the 'messages' table and filter client-side.
            // This is functional but inefficient at scale.
            //
            // IDEAL FIX:
            // 1. In Supabase SQL Editor, run: `ALTER TABLE public.messages ADD COLUMN room_id TEXT;`
            // 2. Update `supabaseClient.tsx -> sendMessage` to include the `room_id` in the payload.
            // 3. Replace this workaround with the private channel subscription logic below.
            console.warn(`[Chat Dev] Using inefficient public subscription for real-time. See comments in DirectChat.tsx for the ideal, performant fix.`);

            channel = supabase.channel('public-messages-workaround')
               .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                   const msgRaw = payload.new;
                   const msg = parseMessageContent(msgRaw);
                   
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
        
        const optimisticMsg: Message = {
            id: `local_${Date.now()}`,
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
            // Revert optimistic update on failure
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
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