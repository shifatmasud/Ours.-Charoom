
import { createClient } from '@supabase/supabase-js';
import { Post, Message, Notification, Profile, CurrentUser, Comment } from '../types';

// --- Configuration ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lezvekpflqbxornefbwh.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlenZla3BmbHFieG9ybmVmYndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MDM1OTEsImV4cCI6MjA3OTI3OTU5MX0._fN9MxAivt_GyYv81lR7VJUShAPnYQ5txynHxwyrftw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  sendNotification: async (userId: string, senderId: string, type: 'like' | 'comment' | 'follow', referenceId: string, mediaUrl?: string): Promise<void> => {
      try {
          await fetch('https://lezvekpflqbxornefbwh.supabase.co/functions/v1/send-notification', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_KEY}`
              },
              body: JSON.stringify({ userId, senderId, type, referenceId, mediaUrl })
          });
      } catch (e) {
          console.error("Failed to send notification via Edge Function", e);
      }
  },

  // --- Auth ---
  signUpWithEmail: async (email: string, pass: string, fullName: string): Promise<void> => {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
  },

  signInWithPassword: async (email: string, pass: string): Promise<CurrentUser> => {
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
    // Use getSession first as it's faster (local storage)
    const { data: sessionData } = await supabase.auth.getSession();
    let user = sessionData?.session?.user;
    
    if (!user) {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) throw authError || new Error('No user logged in');
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
            if (error) console.error('Error fetching profile:', error);
            return data;
        } catch (e) {
            console.warn('Profile fetch timed out, using fallback');
            return null;
        }
    };

    const data = await fetchProfile();
    
    // Fetch real-time counts directly from follows table - wrap in try/catch to prevent blocking
    const fetchCount = async (query: any) => {
        try {
            // Add a 5s timeout for count queries
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
            const { count, error } = await Promise.race([query, timeoutPromise]) as any;
            if (error) return 0;
            return count || 0;
        } catch (e) {
            console.warn('Count fetch timed out or failed:', e);
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
    
    // Return merged data or fallback from auth metadata
    return {
        id: user.id,
        username: data?.username || user.user_metadata?.full_name?.replace(/\s+/g, '_').toLowerCase() || user.email?.split('@')[0] || 'user',
        avatar_url: data?.avatar_url || user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        full_name: data?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous',
        bio: data?.bio,
        followers_count: followersCount,
        following_count: followingCount
    };
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
    
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;

    // Fetch real-time counts from the source of truth - wrap in try/catch to prevent blocking
    const fetchCount = async (query: any) => {
        try {
            const { count, error } = await query;
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
  },

  getAllProfiles: async (): Promise<Profile[]> => {
    const { data } = await supabase.from('profiles').select('*').limit(50);
    return data || [];
  },

  // --- Feed & Posts ---
  getFeed: async (): Promise<Post[]> => {
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch posts with profiles and real-time counts from related tables
    // 5s timeout for feed query
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
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('Feed fetch timed out or failed:', e);
            return [];
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
      const { data } = await supabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      return data || [];
  },

  createPost: async (imageUrl: string, caption: string, userId: string): Promise<void> => {
    await supabase.from('posts').insert({ user_id: userId, image_url: imageUrl, caption });
  },

  deletePost: async (postId: string): Promise<void> => {
    await supabase.from('posts').delete().eq('id', postId);
  },

  likePost: async (postId: string, userId: string, ownerId: string): Promise<void> => {
    // Check if already liked
    const { data } = await supabase.from('likes').select('id').match({ user_id: userId, post_id: postId }).single();
    
    if (data) {
        await supabase.from('likes').delete().eq('id', data.id);
    } else {
        await supabase.from('likes').insert({ user_id: userId, post_id: postId });
        // Trigger notification if not self-like
        if (userId !== ownerId) {
            await api.sendNotification(ownerId, userId, 'like', postId);
        }
    }
  },

  // --- Comments ---
  getComments: async (postId: string): Promise<Comment[]> => {
    const { data } = await supabase.from('comments').select('*, profile:user_id(*)').eq('post_id', postId).order('created_at', { ascending: true });
    return data || [];
  },

  addComment: async (postId: string, userId: string, content: string, ownerId: string): Promise<Comment> => {
    const { data, error } = await supabase.from('comments').insert({ post_id: postId, user_id: userId, content }).select('*, profile:user_id(*)').single();
    if (error) throw error;
    
    // Trigger notification if not self-comment
    if (userId !== ownerId) {
        await api.sendNotification(ownerId, userId, 'comment', postId);
    }
    
    return data;
  },

  deleteComment: async (commentId: string): Promise<void> => {
      await supabase.from('comments').delete().eq('id', commentId);
  },

  // --- Interactions ---
  followUser: async (followerId: string, targetId: string): Promise<void> => {
      await supabase.from('follows').insert({ follower_id: followerId, following_id: targetId });
      // Trigger notification
      await api.sendNotification(targetId, followerId, 'follow', targetId);
  },

  unfollowUser: async (followerId: string, targetId: string): Promise<void> => {
      await supabase.from('follows').delete().match({ follower_id: followerId, following_id: targetId });
  },

  // --- Messaging ---
  getMessages: async (friendId: string): Promise<Message[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase.from('messages').select('*')
         .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
         .order('created_at', { ascending: true });
         
      if (error) throw error;
      
      // Parse JSON content if necessary
      return (data || []).map(parseMessageContent);
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

  sendMessage: async (senderId: string, receiverId: string, content: string, type: 'text' | 'image' | 'audio' = 'text', mediaUrl?: string): Promise<void> => {
      // Pack rich data into 'content' if it's not plain text, to support restricted schema
      let finalContent = content;
      if (type !== 'text' || mediaUrl) {
          finalContent = JSON.stringify({
              content: content,
              type: type,
              media_url: mediaUrl
          });
      }

      const { error } = await supabase.from('messages').insert({ 
          sender_id: senderId, 
          receiver_id: receiverId, 
          content: finalContent 
      });
      
      if (error) throw error;
  },

  // --- Storage ---
  uploadFile: async (file: File): Promise<string> => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const { error } = await supabase.storage.from('images').upload(fileName, file);
      if (error) throw error;
      
      const { data } = supabase.storage.from('images').getPublicUrl(fileName);
      return data.publicUrl;
  },

  // --- Notifications ---
  getNotifications: async (): Promise<Notification[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      try {
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
          const { data } = await Promise.race([
              supabase.from('notifications').select('*, sender_profile:sender_id(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
              timeout
          ]) as any;
          return data || [];
      } catch (e) {
          console.warn('Notifications fetch timed out or failed:', e);
          return [];
      }
  },

  markNotificationRead: async (notifId: string) => {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
  }
};
