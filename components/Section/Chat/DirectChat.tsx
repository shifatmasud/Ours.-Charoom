import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, supabase, parseMessageContent } from '../../../services/supabaseClient';
import { Message, CurrentUser } from '../../../types';
import { motion } from 'framer-motion';
import { theme, commonStyles } from '../../../Theme';
import { Lightbox } from '../../Core/Lightbox';
import { ChatHeader, ChatInput, MessageBubble } from './ChatPrimitives';

import { useAuth } from '../../../contexts/AuthContext';

interface DirectChatProps {
    friendId: string;
}

export const DirectChat: React.FC<DirectChatProps> = ({ friendId }) => {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [friendProfile, setFriendProfile] = useState<any>(null);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        console.log("DirectChat mounted");
        return () => console.log("DirectChat unmounted");
    }, []);

    useEffect(() => {
        setTimeout(scrollToBottom, 100);
    }, [messages.length]);

    useEffect(() => {
        if (!currentUser) return;
        let ignore = false;
        let channel: any = null;

        const init = async () => {
            // Fetch Messages
            const msgs = await api.getMessages(friendId);
            if (ignore) return;
            setMessages(msgs);

            const friend = (await api.getAllProfiles()).find(p => p.id === friendId);
            if (ignore) return;
            setFriendProfile(friend);

            // Subscribe to DM updates via broadcast
            const channelName = `dm-${[currentUser.id, friendId].sort().join('-')}`;
            channel = supabase.channel(channelName)
               .on('broadcast', { event: 'new_message' }, payload => {
                   const msgRaw = payload.payload;
                   const msg = parseMessageContent(msgRaw);
                   
                   // Only add incoming messages from the friend. My own messages are added optimistically.
                   if (msg.sender_id === friendId && msg.receiver_id === currentUser.id) {
                        setMessages(prev => {
                           // Still good to keep the duplicate check for other race conditions
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
    }, [friendId, currentUser]);

    const handleSend = async (content: string, type: 'text'|'image'|'audio' = 'text', mediaUrl?: string) => {
        if (!currentUser) return;
        console.log("handleSend called", content, type);
        
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
        console.log("Adding optimistic message", optimisticMsg);
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            console.log("Calling api.sendMessage");
            const realMsg = await api.sendMessage(currentUser.id, friendId, content, type, mediaUrl, currentUser.username);
            console.log("api.sendMessage success");
            setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));
        } catch (e) {
            console.error("Send failed", e);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const startCall = async () => {
        if (!currentUser) return;
        const roomId = [currentUser.id, friendId].sort().join('-');
        
        try {
            await api.sendNotification(friendId, currentUser.id, 'call', roomId, undefined, currentUser.username);
        } catch (e) {
            console.error("Failed to send call notification", e);
        }
        
        navigate(`/call/${roomId}`);
    };

    return (
        <>
            {lightboxSrc && <Lightbox isOpen={true} src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
            <div 
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
            </div>
        </>
    );
};
