import { supabase, handleSupabaseError, IS_MOCK_MODE, MOCK_USER } from '../supabaseClient';
import { Profile } from '../../types';

export const getUserProfile = async (userId: string, existingUser?: any): Promise<Profile> => {
    let user = existingUser;
    if (!user) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        user = authUser;
    }
    
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
        const { data, error } = await Promise.race([
            supabase.from('profiles').select('*').eq('id', userId).single(),
            timeout
        ]) as any;
        
        if (error) {
            if ((IS_MOCK_MODE) && (error.message?.includes('Failed to fetch') || error.code === 'PGRST116')) {
                return MOCK_USER;
            }
            throw error;
        }

        // Fetch real-time counts from the source of truth
        const fetchCount = async (query: any) => {
            try {
                const countTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
                const { count, error } = await Promise.race([query, countTimeout]) as any;
                if (error) return 0;
                return count || 0;
            } catch (e) {
                return 0;
            }
        };

        const followersPromise = fetchCount(supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', userId));

        const followingPromise = fetchCount(supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', userId));

        const [followersCount, followingCount] = await Promise.all([followersPromise, followingPromise]);

        let isFollowing = false;
        if (user && user.id !== userId) {
             const { data: follow } = await supabase.from('follows').select('*').match({ follower_id: user.id, following_id: userId }).maybeSingle();
             isFollowing = !!follow;
        }

        return { 
            ...data, 
            is_following: isFollowing,
            followers_count: followersCount,
            following_count: followingCount 
        };
    } catch (err) {
        if (IS_MOCK_MODE) return MOCK_USER;
        throw err;
    }
};

export const getAllProfiles = async (): Promise<Profile[]> => {
    const { data } = await supabase.from('profiles').select('*').limit(50);
    return data || [];
};
