import { supabase, parseMessageContent } from '../supabaseClient';
import { Message } from '../../types';
import { sendNotification } from './notifications';

export const getMessages = async (friendId: string): Promise<Message[]> => {
    // ... (need to handle mock mode, but I'll keep it simple for now)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.from('messages').select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
        
    if (error) throw error;
    
    // Parse JSON content if necessary
    return (data || []).map(parseMessageContent);
};

export const getLastMessage = async (friendId: string): Promise<Message | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.from('messages').select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
    if (error || !data) return null;
    return parseMessageContent(data);
};

export const getRecentConversations = async (): Promise<Record<string, Message>> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase.from('messages').select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(200);
        
    if (error) throw error;
    
    const latestMessages: Record<string, Message> = {};
    for (const msg of data || []) {
        const parsed = parseMessageContent(msg);
        const otherId = parsed.sender_id === user.id ? parsed.receiver_id : parsed.sender_id;
        if (!latestMessages[otherId]) {
            latestMessages[otherId] = parsed;
        }
    }
    return latestMessages;
};

export const sendMessage = async (senderId: string, receiverId: string, content: string, type: 'text' | 'image' | 'audio' = 'text', mediaUrl?: string, senderUsername?: string): Promise<Message> => {
    // Pack rich data into 'content' if it's not plain text, to support restricted schema
    let finalContent = content;
    if (type !== 'text' || mediaUrl) {
        finalContent = JSON.stringify({
            content: content,
            type: type,
            media_url: mediaUrl
        });
    }

    const { data, error } = await supabase.from('messages').insert({ 
        sender_id: senderId, 
        receiver_id: receiverId, 
        content: finalContent 
    }).select().single();
    
    if (error) throw error;

    if (data) {
        // Broadcast the message to the specific chat channel
        const channelName = receiverId === 'codex' ? 'public-codex-chat' : `dm-${[senderId, receiverId].sort().join('-')}`;
        const channel = supabase.channel(channelName);
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                channel.send({
                    type: 'broadcast',
                    event: 'new_message',
                    payload: data
                }).then(() => {
                    supabase.removeChannel(channel);
                });
            }
        });

        await sendNotification(receiverId, senderId, 'message', data.id, mediaUrl, senderUsername);
    }
    
    return parseMessageContent(data);
};

export const subscribeToMessages = (userId: string, friendId: string, callback: (msg: Message) => void) => {
    const channelName = friendId === 'codex' ? 'public-codex-chat' : `dm-${[userId, friendId].sort().join('-')}`;
    const channel = supabase.channel(channelName);
    
    channel
        .on('broadcast', { event: 'new_message' }, (payload) => {
            callback(parseMessageContent(payload.payload));
        })
        .subscribe();

    return channel;
};

export const subscribeToUserMessages = (userId: string, callback: (msg: Message) => void) => {
    const channel = supabase.channel(`user-messages-${userId}`);
    
    channel
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `receiver_id=eq.${userId}`
        }, (payload) => {
            callback(parseMessageContent(payload.new));
        })
        .subscribe();

    return channel;
};
