

import { createClient } from '@supabase/supabase-js';
import { Post, Message, Notification, Profile, CurrentUser, Comment } from '../types';

// --- Configuration ---
const SUPABASE_URL = 'https://lezvekpflqbxornefbwh.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlenZla3BmbHFieG9ybmVmYndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MDM1OTEsImV4cCI6MjA3OTI3OTU5MX0._fN9MxAivt_GyYv81lR7VJUShAPnYQ5txynHxwyrftw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Mock Data (Fallback & Guest Write Simulation) ---
let MOCK_USER: CurrentUser = {
  id: 'guest_root',
  username: 'guest_user',
  avatar_url: 'https://picsum.photos/seed/guest/100/100',
  full_name: 'Guest Explorer',
  bio: 'Just visiting the void.',
  followers_count: 0,
  following_count: 0,
  is_admin: true
};

// Fallback data in case DB is empty or connection fails
let MOCK_PROFILES: Profile[] = [
  MOCK_USER,
  { id: 'u2', username: 'neon_rider', avatar_url: 'https://picsum.photos/seed/u2/100/100', bio: 'Cyberpunk enthusiast', followers_count: 8500, following_count: 200 },
  { id: 'u3', username: 'film_grain', avatar_url: 'https://picsum.photos/seed/u3/100/100', bio: 'Analog photography', followers_count: 3200, following_count: 150 },
];

let MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    user_id: 'u2',
    image_url: 'https://picsum.photos/seed/art1/600/600',
    caption: 'Fallback Content: Neon nights 🌃',
    created_at: new Date().toISOString(),
    profiles: MOCK_PROFILES.find(p => p.id === 'u2'),
    likes_count: 124,
    has_liked: false,
    comments_count: 2
  }
];

const MOCK_COMMENTS: Comment[] = [];

// Persistence for Messages
const loadMockMessages = (): Message[] => {
    try {
        const stored = localStorage.getItem('mock_messages_v2');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

let MOCK_MESSAGES: Message[] = loadMockMessages();

const saveMockMessages = () => {
    try {
        localStorage.setItem('mock_messages_v2', JSON.stringify(MOCK_MESSAGES));
    } catch (e) {
        console.warn("Failed to save messages", e);
    }
};

const MOCK_FOLLOWS = new Set<string>(); 
// Tracking deleted items for Guest/Admin session
const DELETED_POST_IDS = new Set<string>();
const DELETED_COMMENT_IDS = new Set<string>();

// Helper: Check if we are in Guest Mode
const isGuestMode = () => localStorage.getItem('mock_auth') === 'true';

// --- Service Layer ---

export const api = {
  // --- Auth ---
  signUpWithEmail: async (email: string, pass: string, fullName: string): Promise<void> => {
    localStorage.removeItem('mock_auth');
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          full_name: fullName,
          avatar_url: `https://picsum.photos/seed/${email}/200/200`
        }
      }
    });
    if (error) throw error;
  },

  signInWithPassword: async (id: string, pass: string): Promise<CurrentUser> => {
    // Secret Guest Login Logic (root/root)
    if (id === 'root' && pass === 'root') {
       await new Promise(r => setTimeout(r, 800)); // Simulate network delay
       localStorage.setItem('mock_auth', 'true');
       // Clear deletions on new login
       DELETED_POST_IDS.clear();
       DELETED_COMMENT_IDS.clear();
       return MOCK_USER;
    }
    
    // Real Auth
    localStorage.removeItem('mock_auth');
    const { data, error } = await supabase.auth.signInWithPassword({ email: id, password: pass });
    if (error) throw error;
    
    // Fetch profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    return profile || { 
      id: data.user.id, 
      username: data.user.email?.split('@')[0] || 'new_user',
      avatar_url: 'https://picsum.photos/100/100'
    };
  },

  resetPassword: async (email: string): Promise<void> => {
    if (isGuestMode()) {
       await new Promise(r => setTimeout(r, 1000));
       return;
    }
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/#/login',
    });
    if (error) throw error;
  },

  signOut: async (): Promise<void> => {
    if (isGuestMode()) {
      localStorage.removeItem('mock_auth');
    } else {
      await supabase.auth.signOut();
    }
    window.location.href = '/';
  },

  getCurrentUser: async (): Promise<CurrentUser> => {
    if (isGuestMode()) return { ...MOCK_USER };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user');
    
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    
    if (error || !data) {
       // Fallback if profile trigger hasn't run yet
       return {
         id: user.id,
         username: user.email?.split('@')[0] || 'user',
         avatar_url: user.user_metadata?.avatar_url || 'https://picsum.photos/100/100',
         full_name: user.user_metadata?.full_name || '',
       };
    }
    
    // Fetch counts for current user too
    const { count: followers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
    const { count: following } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);

    return { 
      ...data, 
      followers_count: followers || 0,
      following_count: following || 0
    };
  },

  // --- Profiles ---
  getUserProfile: async (userId: string): Promise<Profile> => {
    if (userId === 'codex') {
        return {
            id: 'codex',
            username: 'Codex',
            avatar_url: 'https://picsum.photos/seed/codex/100/100', // Placeholder
            bio: 'The Global Void.'
        };
    }
    if (userId === MOCK_USER.id) return MOCK_USER;

    // Always try DB first (even for guest) so we can see seeded users
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    
    if (data) {
      // Parallel fetch for counts to fix "0" bug
      const [followersReq, followingReq] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
      ]);

      const followersCount = followersReq.count || 0;
      const followingCount = followingReq.count || 0;

      const profile = { 
        ...data, 
        followers_count: followersCount,
        following_count: followingCount
      };

      // Check follow status if logged in as real user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { count } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', user.id)
          .eq('following_id', userId);
        return { ...profile, is_following: (count || 0) > 0 };
      } else if (isGuestMode()) {
         return { ...profile, is_following: MOCK_FOLLOWS.has(`${MOCK_USER.id}:${userId}`) };
      }
      return profile;
    }

    // Fallback for missing profiles to prevent crash
    return {
        id: userId,
        username: 'unknown',
        avatar_url: `https://picsum.photos/seed/${userId}/100/100`,
        bio: 'Profile not found'
    };
  },

  getAllProfiles: async (): Promise<Profile[]> => {
    const { data } = await supabase.from('profiles').select('*').limit(50);
    
    let profiles = data || [];
    
    // If guest, inject guest user into the list if not present
    if (isGuestMode() && !profiles.find(p => p.id === MOCK_USER.id)) {
        profiles = [MOCK_USER, ...profiles];
    }

    // Fallback only if DB strictly empty
    if (profiles.length === 0) return MOCK_PROFILES;
    
    return profiles;
  },

  updateCurrentUser: async (updates: Partial<CurrentUser>): Promise<CurrentUser> => {
    if (isGuestMode()) {
      MOCK_USER = { ...MOCK_USER, ...updates };
      return MOCK_USER;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // --- Feed & Posts ---
  getFeed: async (): Promise<Post[]> => {
    // Try fetching from real DB first, including count of likes and comments
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:user_id(*), likes(count), comments(count)') // Relational select with count
      .order('created_at', { ascending: false });

    let realPosts: Post[] = [];

    if (data && data.length > 0) {
      // Process likes state
      const { data: { user } } = await supabase.auth.getUser();
      let likedSet = new Set<string>();
      
      if (user) {
        const { data: likes } = await supabase.from('likes').select('post_id').eq('user_id', user.id);
        likes?.forEach(l => likedSet.add(l.post_id));
      }
      
      // Map and handle missing profiles safely
      realPosts = data.map((p: any) => ({ 
          ...p, 
          profiles: p.profiles || { id: p.user_id, username: 'unknown', avatar_url: 'https://picsum.photos/100/100' },
          has_liked: likedSet.has(p.id),
          likes_count: p.likes ? p.likes[0]?.count : 0, // Extract count from Supabase response
          comments_count: p.comments ? p.comments[0]?.count : 0 // Extract count from Supabase response
      }));
    }

    // If Guest, we need to merge MOCK_POSTS and realPosts, then filter deleted
    if (isGuestMode()) {
        const allPosts = [...realPosts, ...MOCK_POSTS]; // Prefer Real posts first
        // Deduplicate
        const seen = new Set();
        const uniquePosts = allPosts.filter(p => {
             if (seen.has(p.id)) return false;
             seen.add(p.id);
             return true;
        });

        // Filter out deleted posts (simulated for Guest Admin)
        return uniquePosts
            .filter(p => !DELETED_POST_IDS.has(p.id))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return realPosts.length > 0 ? realPosts : MOCK_POSTS;
  },

  getPost: async (postId: string): Promise<Post | null> => {
    // Guest Mode Check
    if (isGuestMode()) {
      if (DELETED_POST_IDS.has(postId)) return null;

      const mockP = MOCK_POSTS.find(p => p.id === postId);
      if (mockP) return mockP;

      // Fallback: Try to fetch real post for guest view
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles:user_id(*), likes(count), comments(count)')
        .eq('id', postId)
        .single();
        
      if (data) {
          return {
             ...data,
             profiles: data.profiles || { id: data.user_id, username: 'unknown', avatar_url: 'https://picsum.photos/100/100' },
             has_liked: false,
             likes_count: data.likes ? data.likes[0]?.count : 0,
             comments_count: data.comments ? data.comments[0]?.count : 0
          };
      }
      return null;
    }

    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles:user_id(*), likes(count), comments(count)')
      .eq('id', postId)
      .single();

    if (error || !data) return null;

    // Check if liked by current user
    const { data: { user } } = await supabase.auth.getUser();
    let hasLiked = false;
    if (user) {
      const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId).eq('user_id', user.id);
      hasLiked = (count || 0) > 0;
    }

    return {
      ...data,
      profiles: data.profiles || { id: data.user_id, username: 'unknown', avatar_url: 'https://picsum.photos/100/100' },
      has_liked: hasLiked,
      likes_count: data.likes ? data.likes[0]?.count : 0,
      comments_count: data.comments ? data.comments[0]?.count : 0
    };
  },

  getUserPosts: async (userId: string): Promise<Post[]> => {
    if (userId === MOCK_USER.id) {
       return MOCK_POSTS.filter(p => p.user_id === MOCK_USER.id && !DELETED_POST_IDS.has(p.id));
    }

    // Try DB with full relations and counts
    const { data } = await supabase
      .from('posts')
      .select('*, profiles:user_id(*), likes(count), comments(count)') // Include comments count
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (data && data.length > 0) {
        // Fetch has_liked status for viewer
        const { data: { user } } = await supabase.auth.getUser();
        let likedSet = new Set<string>();
        
        if (user) {
            const postIds = data.map((p: any) => p.id);
            if (postIds.length > 0) {
              const { data: likes } = await supabase
                .from('likes')
                .select('post_id')
                .eq('user_id', user.id)
                .in('post_id', postIds);
              likes?.forEach(l => likedSet.add(l.post_id));
            }
        }

        const mapped = data.map((p: any) => ({
             ...p,
             profiles: p.profiles || { id: p.user_id, username: 'unknown', avatar_url: 'https://picsum.photos/100/100' },
             has_liked: likedSet.has(p.id),
             likes_count: p.likes ? p.likes[0]?.count : 0,
             comments_count: p.comments ? p.comments[0]?.count : 0
        }));

        if (isGuestMode()) {
            return mapped.filter((p: any) => !DELETED_POST_IDS.has(p.id));
        }
        return mapped;
    }
    
    // Fallback
    return MOCK_POSTS.filter(p => p.user_id === userId && !DELETED_POST_IDS.has(p.id));
  },

  createPost: async (imageUrl: string, caption: string, userId: string): Promise<void> => {
    if (isGuestMode()) {
      // Simulate locally for guest
      MOCK_POSTS.unshift({
        id: `mock_${Date.now()}`,
        user_id: userId,
        image_url: imageUrl,
        caption,
        created_at: new Date().toISOString(),
        profiles: MOCK_USER,
        likes_count: 0,
        has_liked: false,
        comments_count: 0
      });
      return;
    }

    const { error } = await supabase.from('posts').insert({ user_id: userId, image_url: imageUrl, caption });
    if (error) throw error;
  },

  deletePost: async (postId: string): Promise<void> => {
    if (isGuestMode()) {
        MOCK_POSTS = MOCK_POSTS.filter(p => p.id !== postId);
        DELETED_POST_IDS.add(postId); // Track locally for session
        return;
    }
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) throw error;
  },

  likePost: async (postId: string, userId: string, ownerId: string): Promise<void> => {
    if (isGuestMode()) return; // Visual toggle handled by component state

    // Check if already liked
    const { data } = await supabase.from('likes').select('*').eq('user_id', userId).eq('post_id', postId).single();
    
    if (data) {
       await supabase.from('likes').delete().eq('id', data.id);
    } else {
       await supabase.from('likes').insert({ user_id: userId, post_id: postId });
    }
  },

  // --- Comments ---
  getComments: async (postId: string): Promise<Comment[]> => {
    let comments: Comment[] = [];
    const { data } = await supabase
      .from('comments')
      .select('*, profile:user_id(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
      
    if (data) {
        comments = data.map((c: any) => ({ 
            ...c, 
            profile: c.profile || { id: c.user_id, username: 'unknown', avatar_url: 'https://picsum.photos/30/30' }
        }));
    }
    
    if (isGuestMode()) {
        const local = MOCK_COMMENTS.filter(c => c.post_id === postId);
        const all = [...comments, ...local];
        // Filter deleted
        return all.filter(c => !DELETED_COMMENT_IDS.has(c.id))
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    return comments.length > 0 ? comments : MOCK_COMMENTS.filter(c => c.post_id === postId);
  },

  addComment: async (postId: string, userId: string, content: string): Promise<Comment> => {
    if (isGuestMode()) {
      const c = {
        id: `c_${Date.now()}`,
        post_id: postId,
        user_id: userId,
        content,
        created_at: new Date().toISOString(),
        profile: MOCK_USER
      };
      MOCK_COMMENTS.push(c);
      return c;
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: userId, content })
      .select('*, profile:user_id(*)')
      .single();
      
    if (error) throw error;
    return { ...data, profile: data.profile };
  },

  deleteComment: async (commentId: string): Promise<void> => {
    if (isGuestMode()) {
        const index = MOCK_COMMENTS.findIndex(c => c.id === commentId);
        if (index > -1) MOCK_COMMENTS.splice(index, 1);
        DELETED_COMMENT_IDS.add(commentId);
        return;
    }
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) throw error;
  },

  // --- Interactions ---
  followUser: async (followerId: string, targetId: string): Promise<void> => {
    if (isGuestMode()) { MOCK_FOLLOWS.add(`${followerId}:${targetId}`); return; }
    await supabase.from('follows').insert({ follower_id: followerId, following_id: targetId });
  },

  unfollowUser: async (followerId: string, targetId: string): Promise<void> => {
    if (isGuestMode()) { MOCK_FOLLOWS.delete(`${followerId}:${targetId}`); return; }
    await supabase.from('follows').delete().match({ follower_id: followerId, following_id: targetId });
  },

  // --- Messaging ---
  getMessages: async (friendId: string): Promise<Message[]> => {
    if (friendId === 'codex') {
        // Return global/group messages
        // Prioritize persistent MOCK messages if they exist (for Guest or Hybrid)
        if (isGuestMode()) return MOCK_MESSAGES.filter(m => m.receiver_id === 'codex');
        
        // Even for real users, we might want to check DB but fallback to mock if DB is empty to show something
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('receiver_id', 'codex')
            .order('created_at', { ascending: true });
            
        if (error || !data || data.length === 0) {
             return MOCK_MESSAGES.filter(m => m.receiver_id === 'codex');
        }
        return data || [];
    }

    if (isGuestMode()) {
        // Return messages exchanged between Guest and Friend
        return MOCK_MESSAGES.filter(m => 
            (m.sender_id === MOCK_USER.id && m.receiver_id === friendId) || 
            (m.sender_id === friendId && m.receiver_id === MOCK_USER.id)
        ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  getLastMessage: async (friendId: string): Promise<Message | null> => {
    if (friendId === 'codex') {
        // Last message from codex
        const { data } = await supabase.from('messages').select('*').eq('receiver_id', 'codex').order('created_at', { ascending: false }).limit(1);
        const dbMsg = data?.[0];
        const mockMsg = MOCK_MESSAGES.filter(m => m.receiver_id === 'codex').pop();
        
        // Return whichever is newer
        if (dbMsg && mockMsg) {
             return new Date(dbMsg.created_at) > new Date(mockMsg.created_at) ? dbMsg : mockMsg;
        }
        return dbMsg || mockMsg || null;
    }

    if (isGuestMode()) {
        const msgs = MOCK_MESSAGES.filter(m => 
            (m.sender_id === MOCK_USER.id && m.receiver_id === friendId) || 
            (m.sender_id === friendId && m.receiver_id === MOCK_USER.id)
        );
        return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: false })
      .limit(1);

    return data && data.length > 0 ? data[0] : null;
  },

  sendMessage: async (senderId: string, receiverId: string, content: string, type: 'text' | 'image' | 'audio' = 'text', mediaUrl?: string): Promise<void> => {
    const newMessage: Message = {
        id: `msg_${Date.now()}_${Math.random()}`,
        sender_id: senderId,
        receiver_id: receiverId,
        content: content,
        type: type,
        media_url: mediaUrl,
        created_at: new Date().toISOString()
    };

    if (isGuestMode() || receiverId === 'codex') {
        const mockMsg = { ...newMessage };
        MOCK_MESSAGES.push(mockMsg);
        saveMockMessages(); // Persist to storage

        if (receiverId !== 'codex' && !isGuestMode()) {
            // If not codex and real user, also save to DB
        }
        
        if (receiverId !== 'codex' && isGuestMode()) {
            // Auto reply for guest
             setTimeout(() => {
                const replies = [
                    "That's interesting! Tell me more.",
                    "I'm just a simulation, but I'm listening.",
                    "Cool perspective!",
                    "Sending bytes from the void... 🌌",
                    "Can't wait to see real updates."
                ];
                const randomReply = replies[Math.floor(Math.random() * replies.length)];
                
                const replyMsg: Message = {
                    id: `reply_${Date.now()}`,
                    sender_id: receiverId,
                    receiver_id: senderId,
                    content: randomReply,
                    created_at: new Date().toISOString(),
                    type: 'text'
                };
                MOCK_MESSAGES.push(replyMsg);
                saveMockMessages();
            }, 2000);
        }
        
        // Try saving to Supabase for Codex if possible (Real users)
        if (receiverId === 'codex' && !isGuestMode()) {
             // We also save to local mock just in case DB fails or isn't subscribed efficiently for immediate feedback
             await supabase.from('messages').insert({ sender_id: senderId, receiver_id: receiverId, content, type, media_url: mediaUrl });
        }
        
        return;
    }
    
    await supabase.from('messages').insert({ sender_id: senderId, receiver_id: receiverId, content, type, media_url: mediaUrl });
  },

  // --- Storage ---
  uploadFile: async (file: File): Promise<string> => {
    if (isGuestMode()) {
       return URL.createObjectURL(file);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('images').getPublicUrl(filePath);
    return data.publicUrl;
  },

  getNotifications: async (): Promise<Notification[]> => {
     return []; 
  }
};
