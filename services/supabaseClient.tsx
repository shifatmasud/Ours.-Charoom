
import { createClient } from '@supabase/supabase-js';
import { Post, Message, Notification, Profile, CurrentUser, Comment } from '../types';

// --- Configuration ---
const DEFAULT_URL = 'https://lezvekpflqbxornefbwh.supabase.co';
const RAW_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
// Normalize URL: remove trailing slash if present
const SUPABASE_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlenZla3BmbHFieG9ybmVmYndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MDM1OTEsImV4cCI6MjA3OTI3OTU5MX0._fN9MxAivt_GyYv81lR7VJUShAPnYQ5txynHxwyrftw';

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
    const msg = 'Unable to connect to Supabase. Please check your internet connection and ensure your Supabase project is active.';
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
      const { data, error } = await supabase
          .from('notifications')
          .select('*, sender_profile:profiles!sender_id(*), receiver_profile:profiles!user_id(*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
      
      if (error) throw error;
      
      return (data || []).map((n: any) => ({
        ...n,
        sender_profile: Array.isArray(n.sender_profile) ? n.sender_profile[0] : n.sender_profile,
        receiver_profile: Array.isArray(n.receiver_profile) ? n.receiver_profile[0] : n.receiver_profile
      }));
    } catch (err: any) {
      handleSupabaseError(err);
      return [];
    }
  },

  subscribeToNotifications: (userId: string, callback: (notification: Notification) => void) => {
    return supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          // Fetch the full notification with profiles
          const { data, error } = await supabase
            .from('notifications')
            .select('*, sender_profile:profiles!sender_id(*), receiver_profile:profiles!user_id(*)')
            .eq('id', payload.new.id)
            .single();
          
          if (!error && data) {
            callback({
              ...data,
              sender_profile: Array.isArray(data.sender_profile) ? data.sender_profile[0] : data.sender_profile,
              receiver_profile: Array.isArray(data.receiver_profile) ? data.receiver_profile[0] : data.receiver_profile
            });
          }
        }
      )
      .subscribe();
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
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
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw authError || new Error('No user logged in');
        }
        
        // Fetch profile data
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
            
        if (error) throw error;
        
        // Fetch real-time counts directly from follows table
        const fetchCount = async (query: any) => {
            const { count, error } = await query;
            if (error) return 0;
            return count || 0;
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
        handleSupabaseError(err);
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
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;

        // Fetch real-time counts from the source of truth
        const fetchCount = async (query: any) => {
            const { count, error } = await query;
            if (error) return 0;
            return count || 0;
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
        handleSupabaseError(err);
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

    try {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                profiles:user_id(*),
                likes(count),
                comments(count)
            `)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        const feedData = data || [];
        
        // Batch fetch 'has_liked' status for the current user
        let likedPostIds = new Set<string>();
        if (user) {
            try {
                const { data: likesData } = await supabase
                    .from('likes')
                    .select('post_id')
                    .eq('user_id', user.id);
                likesData?.forEach((l: any) => likedPostIds.add(l.post_id));
            } catch (e) {
                console.warn('Likes status fetch failed:', e);
            }
        }
        
        return feedData.map((p: any) => ({
             ...p,
             profiles: p.profiles,
             likes_count: p.likes?.[0]?.count || 0,
             comments_count: p.comments?.[0]?.count || 0,
             has_liked: likedPostIds.has(p.id)
        }));
    } catch (err: any) {
        handleSupabaseError(err);
        return [];
    }
  },

  subscribeToPosts: (callback: (post: Post) => void) => {
    return supabase
      .channel('public_posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        async (payload) => {
          // Fetch the full post with profiles and counts
          const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                profiles:user_id(*),
                likes(count),
                comments(count)
            `)
            .eq('id', payload.new.id)
            .single();
          
          if (!error && data) {
            callback({
              ...data,
              profiles: data.profiles,
              likes_count: data.likes?.[0]?.count || 0,
              comments_count: data.comments?.[0]?.count || 0,
              has_liked: false
            });
          }
        }
      )
      .subscribe();
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
        
        if (error) throw error;
        
        return (data || []).map((p: any) => ({
            ...p,
            profiles: p.profiles,
            likes_count: p.likes?.[0]?.count || 0,
            comments_count: p.comments?.[0]?.count || 0,
            has_liked: false // Will be updated by the component if needed
        }));
    } catch (err) {
        handleSupabaseError(err);
        return [];
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
  subscribeToPostInteractions: (postId: string, onLike: (payload: any) => void, onComment: (payload: any) => void) => {
    return supabase
      .channel(`post_interactions:${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `post_id=eq.${postId}`
        },
        onLike
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`
        },
        onComment
      )
      .subscribe();
  },

  getComments: async (postId: string): Promise<Comment[]> => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profile:user_id(*)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      handleSupabaseError(err);
      return [];
    }
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      try {
        const { data, error } = await supabase.from('messages').select('*')
           .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
           .order('created_at', { ascending: true });
           
        if (error) throw error;
        
        // Parse JSON content if necessary
        return (data || []).map(parseMessageContent);
      } catch (err) {
        handleSupabaseError(err);
        return [];
      }
  },

  subscribeToMessages: (userId: string, friendId: string, callback: (message: Message) => void) => {
    // We listen for messages where the current user is either sender or receiver
    // and the other party is friendId
    const channelName = `messages:${[userId, friendId].sort().join('-')}`;
    return supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // Note: Supabase filter syntax is limited, so we'll filter in JS if needed
          // or use a broader channel. For now, we'll listen to all inserts and filter in callback.
        },
        (payload) => {
          const msg = parseMessageContent(payload.new);
          if ((msg.sender_id === userId && msg.receiver_id === friendId) || 
              (msg.sender_id === friendId && msg.receiver_id === userId)) {
            callback(msg);
          }
        }
      )
      .subscribe();
  },

  subscribeToUserMessages: (userId: string, callback: (message: Message) => void) => {
    return supabase
      .channel(`user_messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = parseMessageContent(payload.new);
          if (msg.sender_id === userId || msg.receiver_id === userId) {
            callback(msg);
          }
        }
      )
      .subscribe();
  },

  getLastMessage: async (friendId: string): Promise<Message | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase.from('messages').select('*')
         .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
         .order('created_at', { ascending: false })
         .limit(1)
         .single();
         
      if (error || !data) return null;
      return parseMessageContent(data);
  },

  getRecentConversations: async (): Promise<Record<string, Message>> => {
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
      }).select().single();
      
      if (error) throw error;

      if (data) {
          await api.sendNotification(receiverId, senderId, 'message', data.id, mediaUrl, senderUsername);
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
