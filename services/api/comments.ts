import { supabase, IS_MOCK_MODE } from '../supabaseClient';
import { Comment } from '../../types';
import { sendNotification } from './notifications';

export const getComments = async (postId: string): Promise<Comment[]> => {
    if (IS_MOCK_MODE) return [
        { id: 'c1', post_id: postId, user_id: 'other', content: 'This looks amazing!', created_at: new Date().toISOString(), profile: { username: 'fan_1', avatar_url: '' } }
    ] as any;
    const { data } = await supabase.from('comments').select('*, profile:user_id(*)').eq('post_id', postId).order('created_at', { ascending: true });
    return data || [];
};

export const addComment = async (postId: string, userId: string, content: string, ownerId: string, senderUsername?: string, mediaUrl?: string): Promise<Comment> => {
    const { data, error } = await supabase.from('comments').insert({ post_id: postId, user_id: userId, content }).select('*, profile:user_id(*)').single();
    if (error) throw error;
    
    // Trigger notification for all comments (even self-comments) to show in global feed
    await sendNotification(ownerId, userId, 'comment', postId, mediaUrl, senderUsername);
    
    return data;
};

export const deleteComment = async (commentId: string): Promise<void> => {
    await supabase.from('comments').delete().eq('id', commentId);
};
