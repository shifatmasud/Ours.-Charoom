import { supabase } from '../supabaseClient';
import { sendNotification } from './notifications';

export const followUser = async (followerId: string, targetId: string, senderUsername?: string): Promise<void> => {
    await supabase.from('follows').insert({ follower_id: followerId, following_id: targetId });
    // Trigger notification
    await sendNotification(targetId, followerId, 'follow', null as any, undefined, senderUsername);
};

export const unfollowUser = async (followerId: string, targetId: string): Promise<void> => {
    await supabase.from('follows').delete().match({ follower_id: followerId, following_id: targetId });
};
