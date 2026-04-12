
import { createClient } from '@supabase/supabase-js';
import { Post, Message, Notification, Profile, CurrentUser, Comment } from '../types';

// --- Configuration ---
const DEFAULT_URL = 'https://lezvekpflqbxornefbwh.supabase.co';
const RAW_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
// Normalize URL: remove trailing slash if present
const SUPABASE_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlenZla3BmbHFieG9ybmVmYndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MDM1OTEsImV4cCI6MjA3OTI3OTU5MX0._fN9MxAivt_GyYv81lR7VJUShAPnYQ5txynHxwyrftw';

const isDefaultUrl = SUPABASE_URL === DEFAULT_URL;
const IS_MOCK_MODE = typeof window !== 'undefined' && localStorage.getItem('supabase_mock_mode') === 'true';

// --- Mock Data ---
const MOCK_USER: CurrentUser = {
    id: 'mock-user-id',
    username: 'demo_user',
    full_name: 'Demo User',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
    bio: 'This is a demo account because the default Supabase project is unreachable.',
    followers_count: 42,
    following_count: 12
};

const MOCK_POSTS: Post[] = [
    {
        id: 'mock-post-1',
        user_id: 'mock-user-id',
        image_url: 'https://picsum.photos/seed/demo1/600/600',
        caption: 'Welcome to the demo mode! The backend is currently unreachable, so we are showing some sample data.',
        created_at: new Date().toISOString(),
        profiles: MOCK_USER,
        likes_count: 10,
        comments_count: 2,
        has_liked: false
    },
    {
        id: 'mock-post-2',
        user_id: 'other-user-id',
        image_url: 'https://picsum.photos/seed/demo2/600/600',
        caption: 'You can still explore the UI and see how everything looks.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        profiles: {
            id: 'other-user-id',
            username: 'traveler',
            full_name: 'World Traveler',
            avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=traveler'
        },
        likes_count: 25,
        comments_count: 5,
        has_liked: true
    }
];

// Helper to handle "Failed to fetch" errors consistently
const isConnectionError = (err: any) => {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return msg.includes('failed to fetch') || 
         msg.includes('network error') ||
         msg.includes('load failed') ||
         msg.includes('timeout') ||
         err.name === 'TypeError' && msg.includes('fetch');
};

const handleSupabaseError = (err: any) => {
  if (isConnectionError(err)) {
    if (isDefaultUrl) {
        const msg = 'Unable to connect to the default Supabase project. Showing demo data for preview...';
        const error = new Error(msg) as any;
        error.isDefaultUrlError = true;
        error.silent = true;
        throw error;
    }
    const msg = 'Unable to connect to your Supabase project. Please check if your VITE_SUPABASE_URL is correct and the project is active.';
    const error = new Error(msg) as any;
    error.isConnectionError = true;
    throw error;
  }
  throw err;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Disable WebLocks to prevent "Lock broken by another request with the 'steal' option"
    // which occurs when multiple tabs or iframes compete for the same storage lock.
    // We provide a robust no-op lock function that handles different argument patterns.
    lock: async (...args: any[]) => {
      const callback = args.find(a => typeof a === 'function');
      if (callback) return await callback();
      return null;
    },
  }
});

// --- Schema Adapters ---

// Helper to parse potential JSON content for rich media within the 'content' column
export const parseMessageContent = (msg: any): Message => {
  if (!msg) return msg;
  try {
    // Check if content is a JSON string containing our rich media keys
    if (typeof msg.content === 'string' && msg.content.trim().startsWith('{')) {
       const parsed = JSON.parse(msg.content);
       // Verify it has expected structure
       if (parsed.type) {
           return {
             ...msg,
             content: parsed.content || parsed.text || '',
             type: parsed.type || 'text',
             media_url: parsed.media_url
           };
       }
    }
  } catch (e) {
    // Fallback for plain text, do nothing
  }
  // Ensure default type is text if parsing failed or wasn't applicable
  return { ...msg, type: msg.type || 'text' };
};

// --- API Implementation ---

export const api = {
  getNotifications: async (userId: string): Promise<Notification[]> => {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
      const { data, error } = await Promise.race([
        supabase
          .from('notifications')
          .select('*, sender_profile:profiles!sender_id(*), receiver_profile:profiles!user_id(*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        timeout
      ]) as any;
      
      if (error) throw error;
      
      return (data || []).map((n: any) => ({
        ...n,
        sender_profile: Array.isArray(n.sender_profile) ? n.sender_profile[0] : n.sender_profile,
        receiver_profile: Array.isArray(n.receiver_profile) ? n.receiver_profile[0] : n.receiver_profile
      }));
    } catch (err: any) {
      if (err.message === 'timeout') {
          console.warn('Notifications fetch timed out');
          return [];
      }
      if (isConnectionError(err) && isDefaultUrl) {
          return [];
      }
      handleSupabaseError(err);
      return [];
    }
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      if (isConnectionError(err) && isDefaultUrl) return;
      handleSupabaseError(err);
    }
  },

  sendNotification: async (userId: string, senderId: string, type: string, referenceId: string, mediaUrl?: string, senderUsername?: string): Promise<void> => {
      // Ensure referenceId is a valid UUID for the database
      // If it's a composite ID (like roomId), use the senderId or userId as a fallback UUID
      let dbReferenceId = referenceId;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(referenceId)) {
          dbReferenceId = senderId; // Fallback to a valid UUID
      }

      // 1. Instant Broadcast (Optimistic Delivery)
      const broadcastPayload = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          user_id: userId,
          sender_id: senderId,
          type,
          reference_id: referenceId,
          media_url: mediaUrl,
          sender_username: senderUsername,
          created_at: new Date().toISOString(),
          is_read: false
      };

      const channel = supabase.channel('global_activities');
      channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
              channel.send({
                  type: 'broadcast',
                  event: 'activity',
                  payload: broadcastPayload
              }).then(() => {
                  supabase.removeChannel(channel);
              });
          }
      });

      // 2. Edge Function (Persistence & Truth)
      try {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_KEY}`
              },
              body: JSON.stringify({ 
                  user_id: userId, 
                  sender_id: senderId, 
                  type, 
                  reference_id: dbReferenceId, 
                  data: {
                      media_url: mediaUrl,
                      sender_username: senderUsername
                  }
              })
          });

          if (!response.ok) {
              throw new Error(`Edge Function returned ${response.status}`);
          }
      } catch (e: any) {
          console.warn("Edge Function failed, falling back to direct DB insert", e);
          // Fallback: Direct insert into notifications table
          try {
              // Note: We omit media_url from DB insert as it might not be in the schema
              const { error } = await supabase.from('notifications').insert({
                  user_id: userId,
                  sender_id: senderId,
                  type,
                  reference_id: dbReferenceId,
                  is_read: false
              });
              if (error) throw error;
          } catch (dbErr: any) {
              console.error("Direct notification insert failed:", dbErr.message, dbErr.details, dbErr.hint);
          }
      }
  },

  // --- Auth ---
  signUpWithEmail: async (email: string, pass: string, fullName: string): Promise<void> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;
    } catch (err: any) {
      handleSupabaseError(err);
    }
  },

  signInWithPassword: async (email: string, pass: string): Promise<CurrentUser> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      
      // Fetch or construct profile - pass the user object to avoid redundant network calls
      const profile = await api.getUserProfile(data.user.id, data.user).catch(() => null);
      
      if (!profile) {
          // Fallback using auth metadata if profile row is missing
          return {
              id: data.user.id,
              username: data.user.user_metadata?.full_name?.replace(/\s+/g, '_').toLowerCase() || email.split('@')[0],
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.id}`,
              full_name: data.user.user_metadata?.full_name || email.split('@')[0]
          };
      }
      return profile;
    } catch (err: any) {
      handleSupabaseError(err);
    }
  },

  resetPassword: async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/#/login' });
    if (error) throw error;
  },

  updatePassword: async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  signOut: async (): Promise<void> => {
    localStorage.removeItem('sb_user_profile');
    await supabase.auth.signOut();
    window.location.href = '/';
  },

  getCurrentUser: async (): Promise<CurrentUser> => {
    try {
        // Use getSession first as it's faster (local storage)
        const { data: sessionData } = await supabase.auth.getSession();
        let user = sessionData?.session?.user;
        
        if (!user) {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData?.user) {
                // If no user is logged in, and we are explicitly in mock mode, show mock user
                if (IS_MOCK_MODE) return MOCK_USER;
                // If on default URL and unreachable, show mock user
                if (isDefaultUrl) {
                    try {
                        // Quick check if reachable with timeout
                        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
                        await Promise.race([
                            supabase.from('profiles').select('id').limit(1),
                            timeout
                        ]);
                    } catch (e) {
                        console.warn('Auth: Default Supabase project unreachable, using mock user');
                        return MOCK_USER;
                    }
                }
                throw authError || new Error('No user logged in');
            }
            user = authData.user;
        }
        
        // Fetch profile data with a 5s timeout
        const fetchProfile = async () => {
            try {
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
                const { data, error } = await Promise.race([
                    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
                    timeout
                ]) as any;
                if (error) {
                    if (!isConnectionError(error) || !isDefaultUrl) {
                        console.error('Error fetching profile:', error);
                    }
                    handleSupabaseError(error);
                }
                return data;
            } catch (e) {
                if (e instanceof Error && (e.message === 'timeout' || (e as any).isDefaultUrlError)) {
                    if (!isDefaultUrl) console.warn('Profile fetch timed out, using fallback');
                    return null;
                }
                throw e;
            }
        };

        const data = await fetchProfile();
        
        // Fetch real-time counts directly from follows table
        const fetchCount = async (query: any) => {
            try {
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
                const { count, error } = await Promise.race([query, timeoutPromise]) as any;
                if (error) return 0;
                return count || 0;
            } catch (e) {
                return 0;
            }
        };

        const followersPromise = fetchCount(supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', user.id));

        const followingPromise = fetchCount(supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', user.id));
        
        const [followersCount, followingCount] = await Promise.all([followersPromise, followingPromise]);
        
        return {
            id: user.id,
            username: data?.username || user.user_metadata?.full_name?.replace(/\s+/g, '_').toLowerCase() || user.email?.split('@')[0] || 'user',
            avatar_url: data?.avatar_url || user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
            full_name: data?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
            bio: data?.bio,
            followers_count: followersCount,
            following_count: followingCount
        };
    } catch (err: any) {
        if (IS_MOCK_MODE || (isDefaultUrl && isConnectionError(err))) {
            console.warn('Auth: Default project unreachable or mock mode, using mock user');
            return MOCK_USER;
        }
        throw err;
    }
  },

  updateCurrentUser: async (updates: Partial<CurrentUser>): Promise<CurrentUser> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user');
    
    // Whitelist allowed fields to prevent errors with virtual properties
    const safeUpdates: any = {};
    if (updates.full_name !== undefined) safeUpdates.full_name = updates.full_name;
    if (updates.bio !== undefined) safeUpdates.bio = updates.bio;
    if (updates.avatar_url !== undefined) safeUpdates.avatar_url = updates.avatar_url;

    // Use maybeSingle to avoid error if row doesn't exist
    const { data, error } = await supabase.from('profiles').update(safeUpdates).eq('id', user.id).select().maybeSingle();
    
    if (error) throw error;
    
    if (!data) {
        // If profile row missing, create it now
        const username = user.user_metadata?.full_name?.replace(/\s+/g, '_').toLowerCase() || user.email?.split('@')[0] || `user_${user.id.slice(0,8)}`;
        const { error: insertError } = await supabase.from('profiles').insert({
            id: user.id,
            username: username,
            avatar_url: safeUpdates.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
            full_name: safeUpdates.full_name || user.user_metadata?.full_name || '',
            bio: safeUpdates.bio || '',
            updated_at: new Date().toISOString()
        });
        if (insertError) throw insertError;
    }
    
    // Re-fetch to get correct counts and virtuals
    return await api.getUserProfile(user.id);
  },

  // --- Profiles ---
  getUserProfile: async (userId: string, existingUser?: any): Promise<Profile> => {
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
            if ((IS_MOCK_MODE || isDefaultUrl) && (error.message?.includes('Failed to fetch') || error.code === 'PGRST116')) {
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
        if (IS_MOCK_MODE || (isDefaultUrl && isConnectionError(err))) return MOCK_USER;
        throw err;
    }
  },

  getAllProfiles: async (): Promise<Profile[]> => {
    const { data } = await supabase.from('profiles').select('*').limit(50);
    return data || [];
  },

  // --- Feed & Posts ---
  getFeed: async (): Promise<Post[]> => {
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
            if ((isDefaultUrl || IS_MOCK_MODE) && (e.message?.includes('Unable to connect') || e.isDefaultUrlError || e.message === 'timeout')) {
                console.warn('Feed: Using demo posts fallback');
                return MOCK_POSTS;
            }
            throw e;
        }
    };

    const data = await fetchFeed();
    
    // If we got real data but it's empty, and we're on default URL, maybe show demo posts
    // but only if the user isn't logged in or has no posts.
    if (data.length === 0 && isDefaultUrl && !user) {
        return MOCK_POSTS;
    }
    
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
  },

  getPost: async (postId: string): Promise<Post | null> => {
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
  },

  getUserPosts: async (userId: string): Promise<Post[]> => {
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
            if ((IS_MOCK_MODE || (isDefaultUrl && isConnectionError(error))) && error.message?.includes('Failed to fetch')) {
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
        if (IS_MOCK_MODE || isDefaultUrl) {
            return userId === MOCK_USER.id ? MOCK_POSTS : [];
        }
        throw err;
    }
  },

  createPost: async (imageUrl: string, caption: string, userId: string, senderUsername?: string): Promise<Post> => {
    const { data, error } = await supabase.from('posts').insert({ user_id: userId, image_url: imageUrl, caption }).select('*, profiles:user_id(*)').single();
    if (error) throw error;
    
    // Broadcast post creation
    if (data) {
        await api.sendNotification(userId, userId, 'post', data.id, imageUrl, senderUsername);
    }
    
    return {
        ...data,
        likes_count: 0,
        comments_count: 0,
        has_liked: false
    };
  },

  deletePost: async (postId: string): Promise<void> => {
    await supabase.from('posts').delete().eq('id', postId);
  },

  likePost: async (postId: string, userId: string, ownerId: string, senderUsername?: string, mediaUrl?: string): Promise<void> => {
    // Check if already liked
    const { data } = await supabase.from('likes').select('id').match({ user_id: userId, post_id: postId }).single();
    
    if (data) {
        await supabase.from('likes').delete().eq('id', data.id);
    } else {
        await supabase.from('likes').insert({ user_id: userId, post_id: postId });
        // Trigger notification for all likes (even self-likes) to show in global feed
        await api.sendNotification(ownerId, userId, 'like', postId, mediaUrl, senderUsername);
    }
  },

  // --- Comments ---
  getComments: async (postId: string): Promise<Comment[]> => {
    if (IS_MOCK_MODE) return [
        { id: 'c1', post_id: postId, user_id: 'other', content: 'This looks amazing!', created_at: new Date().toISOString(), profile: { username: 'fan_1', avatar_url: '' } }
    ] as any;
    const { data } = await supabase.from('comments').select('*, profile:user_id(*)').eq('post_id', postId).order('created_at', { ascending: true });
    return data || [];
  },

  addComment: async (postId: string, userId: string, content: string, ownerId: string, senderUsername?: string, mediaUrl?: string): Promise<Comment> => {
    const { data, error } = await supabase.from('comments').insert({ post_id: postId, user_id: userId, content }).select('*, profile:user_id(*)').single();
    if (error) throw error;
    
    // Trigger notification for all comments (even self-comments) to show in global feed
    await api.sendNotification(ownerId, userId, 'comment', postId, mediaUrl, senderUsername);
    
    return data;
  },

  deleteComment: async (commentId: string): Promise<void> => {
      await supabase.from('comments').delete().eq('id', commentId);
  },

  // --- Interactions ---
  followUser: async (followerId: string, targetId: string, senderUsername?: string): Promise<void> => {
      await supabase.from('follows').insert({ follower_id: followerId, following_id: targetId });
      // Trigger notification
      await api.sendNotification(targetId, followerId, 'follow', targetId, undefined, senderUsername);
  },

  unfollowUser: async (followerId: string, targetId: string): Promise<void> => {
      await supabase.from('follows').delete().match({ follower_id: followerId, following_id: targetId });
  },

  // --- Messaging ---
  getMessages: async (friendId: string): Promise<Message[]> => {
      if (IS_MOCK_MODE) return [
          { id: 'm1', sender_id: friendId, receiver_id: 'me', content: 'Hey! This is a demo message.', created_at: new Date().toISOString(), type: 'text' }
      ] as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase.from('messages').select('*, sender:profiles!sender_id(*)');
      
      if (friendId === '00000000-0000-0000-0000-000000000000') {
          query = query.eq('receiver_id', friendId);
      } else {
          query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`);
      }

      const { data, error } = await query.order('created_at', { ascending: true });
         
      if (error) throw error;
      
      // Parse JSON content if necessary
      return (data || []).map(parseMessageContent);
  },

  getLastMessage: async (friendId: string): Promise<Message | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      let query = supabase.from('messages').select('*, sender:profiles!sender_id(*)');
      
      if (friendId === '00000000-0000-0000-0000-000000000000') {
          query = query.eq('receiver_id', friendId);
      } else {
          query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(1).single();
         
      if (error || !data) return null;
      return parseMessageContent(data);
  },

  getRecentConversations: async (): Promise<Record<string, Message>> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      const { data, error } = await supabase.from('messages').select('*, sender:profiles!sender_id(*)')
         .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id},receiver_id.eq.00000000-0000-0000-0000-000000000000`)
         .order('created_at', { ascending: false })
         .limit(200);
         
      if (error) throw error;
      
      const latestMessages: Record<string, Message> = {};
      for (const msg of data || []) {
          const parsed = parseMessageContent(msg);
          let otherId;
          if (parsed.receiver_id === '00000000-0000-0000-0000-000000000000') {
              otherId = '00000000-0000-0000-0000-000000000000';
          } else {
              otherId = parsed.sender_id === user.id ? parsed.receiver_id : parsed.sender_id;
          }
          if (!latestMessages[otherId]) {
              latestMessages[otherId] = parsed;
          }
      }
      return latestMessages;
  },

  sendMessage: async (senderId: string, receiverId: string, content: string, type: 'text' | 'image' | 'audio' = 'text', mediaUrl?: string, senderUsername?: string): Promise<Message> => {
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
      }).select('*, sender:profiles!sender_id(*)').single();
      
      if (error) throw error;

      if (data) {
          // Broadcast the message to the specific chat channel
          const channelName = receiverId === '00000000-0000-0000-0000-000000000000' ? 'public-global-chat' : receiverId === 'codex' ? 'public-codex-chat' : `dm-${[senderId, receiverId].sort().join('-')}`;
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

          if (receiverId !== '00000000-0000-0000-0000-000000000000') {
              await api.sendNotification(receiverId, senderId, 'message', data.id, mediaUrl, senderUsername);
          }
      }
      
      return parseMessageContent(data);
  },

  // --- Storage ---
  uploadFile: async (file: File): Promise<string> => {
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const { error } = await supabase.storage.from('images').upload(fileName, file);
          if (error) throw error;
          
          const { data } = supabase.storage.from('images').getPublicUrl(fileName);
          return data.publicUrl;
      } catch (err: any) {
          handleSupabaseError(err);
      }
  }
};
