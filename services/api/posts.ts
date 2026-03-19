import { supabase, handleSupabaseError, IS_MOCK_MODE, MOCK_POSTS, MOCK_USER } from '../supabaseClient';
import { Post } from '../../types';
import { sendNotification } from './notifications';

export const getFeed = async (): Promise<Post[]> => {
    const { data: { user } } = await supabase.auth.getUser();

    const fetchFeed = async () => {
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
            const { data, error } = await Promise.race([
                supabase
                .from('posts')
                .select(`
                    *,
                    profiles:user_id(*),
                    likes(count),
                    comments(count)
                `)
                .order('created_at', { ascending: false }),
                timeout
            ]) as any;
            if (error) {
                handleSupabaseError(error);
            }
            return data || [];
        } catch (e: any) {
            if ((IS_MOCK_MODE) && (e.message?.includes('Unable to connect') || e.message === 'timeout')) {
                console.warn('Feed: Using demo posts fallback');
                return MOCK_POSTS;
            }
            throw e;
        }
    };

    const data = await fetchFeed();
    
    // Batch fetch 'has_liked' status for the current user
    let likedPostIds = new Set<string>();
    if (user) {
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
            const { data: likesData } = await Promise.race([
                supabase
                .from('likes')
                .select('post_id')
                .eq('user_id', user.id),
                timeout
            ]) as any;
            likesData?.forEach((l: any) => likedPostIds.add(l.post_id));
        } catch (e) {
            console.warn('Likes status fetch timed out or failed:', e);
        }
    }
    
    return data.map((p: any) => ({
         ...p,
         profiles: p.profiles,
         // Use the count from relations, fallback to 0
         likes_count: p.likes?.[0]?.count || 0,
         comments_count: p.comments?.[0]?.count || 0,
         has_liked: likedPostIds.has(p.id)
    }));
};

export const getPost = async (postId: string): Promise<Post | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id(*),
        likes(count),
        comments(count)
      `)
      .eq('id', postId)
      .single();
      
    if (error) return null;

    let hasLiked = false;
    if (user) {
       const { data: likeData } = await supabase
         .from('likes')
         .select('id')
         .match({ post_id: postId, user_id: user.id })
         .single();
       hasLiked = !!likeData;
    }

    return {
        ...data,
        profiles: data.profiles,
        likes_count: data.likes?.[0]?.count || 0,
        comments_count: data.comments?.[0]?.count || 0,
        has_liked: hasLiked
    };
};

export const getUserPosts = async (userId: string): Promise<Post[]> => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                profiles:user_id(*),
                likes(count),
                comments(count)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) {
            if (IS_MOCK_MODE && error.message?.includes('Failed to fetch')) {
                return userId === MOCK_USER.id ? MOCK_POSTS : [];
            }
            throw error;
        }
        
        return (data || []).map((p: any) => ({
            ...p,
            profiles: p.profiles,
            likes_count: p.likes?.[0]?.count || 0,
            comments_count: p.comments?.[0]?.count || 0,
            has_liked: false // Will be updated by the component if needed
        }));
    } catch (err) {
        if (IS_MOCK_MODE) {
            return userId === MOCK_USER.id ? MOCK_POSTS : [];
        }
        throw err;
    }
};

export const createPost = async (imageUrl: string, caption: string, userId: string, senderUsername?: string): Promise<Post> => {
    const { data, error } = await supabase.from('posts').insert({ user_id: userId, image_url: imageUrl, caption }).select('*, profiles:user_id(*)').single();
    if (error) throw error;
    
    // Broadcast post creation
    if (data) {
        await sendNotification(userId, userId, 'post', data.id, imageUrl, senderUsername);
    }
    
    return {
        ...data,
        likes_count: 0,
        comments_count: 0,
        has_liked: false
    };
};

export const deletePost = async (postId: string): Promise<void> => {
    await supabase.from('posts').delete().eq('id', postId);
};

export const likePost = async (postId: string, userId: string, ownerId: string, senderUsername?: string, mediaUrl?: string): Promise<void> => {
    // Check if already liked
    const { data } = await supabase.from('likes').select('id').match({ user_id: userId, post_id: postId }).single();
    
    if (data) {
        await supabase.from('likes').delete().eq('id', data.id);
    } else {
        await supabase.from('likes').insert({ user_id: userId, post_id: postId });
        // Trigger notification for all likes (even self-likes) to show in global feed
        await sendNotification(ownerId, userId, 'like', postId, mediaUrl, senderUsername);
    }
};
