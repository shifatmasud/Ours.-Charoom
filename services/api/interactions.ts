import { supabase, IS_MOCK_MODE } from '../supabaseClient';
import { sendNotification } from './notifications';

export const followUser = async (followerId: string, targetId: string, senderUsername?: string): Promise<void> => {
    if (IS_MOCK_MODE) return Promise.resolve();
    await supabase.from('follows').insert({ follower_id: followerId, following_id: targetId });
    // Trigger notification
    await sendNotification(targetId, followerId, 'follow', null as any, undefined, senderUsername);
};

export const unfollowUser = async (followerId: string, targetId: string): Promise<void> => {
    if (IS_MOCK_MODE) return Promise.resolve();
    await supabase.from('follows').delete().match({ follower_id: followerId, following_id: targetId });
};
