
import { createClient } from '@supabase/supabase-js';
import { Post, Message, Notification, Profile, CurrentUser, Comment } from '../types';

// --- Configuration ---
const SUPABASE_URL = ''; 
const SUPABASE_KEY = '';

export const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;

// --- Mock Data ---
let MOCK_USER: CurrentUser = {
  id: 'u1',
  username: 'visual_artist',
  avatar_url: 'https://picsum.photos/seed/u1/100/100',
  full_name: 'Alex Doe',
  bio: 'Digital creator | 📍 NYC',
  followers_count: 12400,
  following_count: 452,
};

let MOCK_PROFILES: Profile[] = [
  MOCK_USER,
  { id: 'u2', username: 'neon_rider', avatar_url: 'https://picsum.photos/seed/u2/100/100', bio: 'Cyberpunk enthusiast', followers_count: 8500, following_count: 200 },
  { id: 'u3', username: 'film_grain', avatar_url: 'https://picsum.photos/seed/u3/100/100', bio: 'Analog photography', followers_count: 3200, following_count: 150 },
  { id: 'u4', username: 'urban_explorer', avatar_url: 'https://picsum.photos/seed/u4/100/100', bio: 'City roamer', followers_count: 5000, following_count: 300 },
];

let MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    user_id: 'u2',
    image_url: 'https://picsum.photos/seed/art1/600/600',
    caption: 'Neon nights in the city 🌃 #cyberpunk',
    created_at: new Date().toISOString(),
    profiles: MOCK_PROFILES.find(p => p.id === 'u2'),
    likes_count: 124,
    has_liked: false,
    comments_count: 2
  },
  {
    id: 'p2',
    user_id: 'u3',
    image_url: 'https://picsum.photos/seed/nature/600/800',
    caption: 'Morning mist via 35mm film 📸',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    profiles: MOCK_PROFILES.find(p => p.id === 'u3'),
    likes_count: 892,
    has_liked: true,
    comments_count: 5
  },
  {
    id: 'p3',
    user_id: 'u1',
    image_url: 'https://picsum.photos/seed/myart/600/700',
    caption: 'My latest workspace setup! 💻',
    created_at: new Date(Date.now() - 100000000).toISOString(),
    profiles: MOCK_USER,
    likes_count: 45,
    has_liked: false,
    comments_count: 0
  }
];

const MOCK_COMMENTS: Comment[] = [
  { id: 'c1', post_id: 'p1', user_id: 'u3', content: 'Incredible colors!', created_at: new Date().toISOString(), profile: MOCK_PROFILES.find(p => p.id === 'u3') },
  { id: 'c2', post_id: 'p1', user_id: 'u4', content: 'Where is this?', created_at: new Date().toISOString(), profile: MOCK_PROFILES.find(p => p.id === 'u4') },
];

const MOCK_MESSAGES: Message[] = [
  { id: 'm1', sender_id: 'u2', receiver_id: 'u1', content: 'Yo! That shot was sick 🔥', created_at: new Date(Date.now() - 3600000).toISOString() },
];

const MOCK_FOLLOWS = new Set<string>(); // Format: "followerId:targetId"

// Helper for mock auth persistence
const getMockAuth = () => localStorage.getItem('mock_auth') === 'true';

// --- Service Layer ---

export const api = {
  // Auth
  signInWithGoogle: async (): Promise<void> => {
      if (supabase) {
          await supabase.auth.signInWithOAuth({ provider: 'google' });
      } else {
          // Mock login
          await new Promise(r => setTimeout(r, 800));
          localStorage.setItem('mock_auth', 'true');
      }
  },

  signInWithPassword: async (id: string, pass: string): Promise<CurrentUser> => {
    if (supabase) {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({ email: id, password: pass });
      if (error) throw error;
      return MOCK_USER; // Simplified for real supabase scenario
    }
    
    // Mock Check
    await new Promise(r => setTimeout(r, 600));
    if (id === 'root' && pass === 'root') {
       localStorage.setItem('mock_auth', 'true');
       return MOCK_USER;
    }
    throw new Error("Invalid Credentials");
  },

  signOut: async (): Promise<void> => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('mock_auth');
  },

  getCurrentUser: async (): Promise<CurrentUser> => {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      return data;
    }
    
    if (!getMockAuth()) throw new Error("Not Authenticated");
    return { ...MOCK_USER };
  },

  getUserProfile: async (userId: string): Promise<Profile> => {
    if (supabase) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      return data;
    }
    const profile = MOCK_PROFILES.find(p => p.id === userId) || MOCK_USER;
    
    // Calculate dynamic follow state for mock
    const isFollowing = MOCK_FOLLOWS.has(`${MOCK_USER.id}:${userId}`);
    return { ...profile, is_following: isFollowing };
  },

  updateCurrentUser: async (updates: Partial<CurrentUser>): Promise<CurrentUser> => {
    if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user');
        const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single();
        if(error) throw error;
        return data;
    }
    MOCK_USER = { ...MOCK_USER, ...updates };
    // Update mock profiles array too
    const idx = MOCK_PROFILES.findIndex(p => p.id === MOCK_USER.id);
    if (idx >= 0) MOCK_PROFILES[idx] = { ...MOCK_PROFILES[idx], ...updates };
    
    return { ...MOCK_USER };
  },

  getFeed: async (): Promise<Post[]> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Post[];
    }
    await new Promise(r => setTimeout(r, 500));
    return [...MOCK_POSTS];
  },

  getUserPosts: async (userId: string): Promise<Post[]> => {
    if (supabase) {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
       if(error) throw error;
       return data as Post[]; 
    }
    await new Promise(r => setTimeout(r, 300));
    return MOCK_POSTS.filter(p => p.user_id === userId);
  },

  createPost: async (imageUrl: string, caption: string, userId: string): Promise<void> => {
    if (supabase) {
      await supabase.from('posts').insert({ user_id: userId, image_url: imageUrl, caption });
    } else {
      const newPost: Post = {
        id: `new_${Date.now()}`,
        user_id: userId,
        image_url: imageUrl,
        caption,
        created_at: new Date().toISOString(),
        profiles: MOCK_USER,
        likes_count: 0,
        has_liked: false,
        comments_count: 0
      };
      MOCK_POSTS.unshift(newPost);
    }
  },

  deletePost: async (postId: string): Promise<void> => {
    if (supabase) {
      await supabase.from('posts').delete().eq('id', postId);
    } else {
      MOCK_POSTS = MOCK_POSTS.filter(p => p.id !== postId);
    }
  },

  updatePost: async (postId: string, updates: { caption: string }): Promise<void> => {
    if (supabase) {
      await supabase.from('posts').update(updates).eq('id', postId);
    } else {
      const post = MOCK_POSTS.find(p => p.id === postId);
      if (post) post.caption = updates.caption;
    }
  },

  getComments: async (postId: string): Promise<Comment[]> => {
    if (supabase) {
      const { data } = await supabase.from('comments').select('*, profile:profiles(*)').eq('post_id', postId);
      return data || [];
    }
    return MOCK_COMMENTS.filter(c => c.post_id === postId);
  },

  addComment: async (postId: string, userId: string, content: string): Promise<Comment> => {
    if (supabase) {
      const { data } = await supabase.from('comments').insert({ post_id: postId, user_id: userId, content }).select('*, profile:profiles(*)').single();
      return data;
    }
    const newComment: Comment = {
      id: `c_${Date.now()}`,
      post_id: postId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
      profile: MOCK_PROFILES.find(p => p.id === userId)
    };
    MOCK_COMMENTS.push(newComment);
    const post = MOCK_POSTS.find(p => p.id === postId);
    if (post) post.comments_count = (post.comments_count || 0) + 1;
    
    return newComment;
  },

  followUser: async (followerId: string, targetId: string): Promise<void> => {
    if (supabase) {
      await supabase.from('follows').insert({ follower_id: followerId, following_id: targetId });
    } else {
      MOCK_FOLLOWS.add(`${followerId}:${targetId}`);
    }
  },

  unfollowUser: async (followerId: string, targetId: string): Promise<void> => {
    if (supabase) {
      await supabase.from('follows').delete().match({ follower_id: followerId, following_id: targetId });
    } else {
      MOCK_FOLLOWS.delete(`${followerId}:${targetId}`);
    }
  },

  // --- Upload ---
  uploadFile: async (file: File): Promise<string> => {
    if (supabase) {
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('images').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(data.path);
      return publicUrl;
    }
    await new Promise(r => setTimeout(r, 1000));
    return URL.createObjectURL(file);
  },

  // --- Chat & Interactions ---
  getMessages: async (friendId: string): Promise<Message[]> => {
    if (supabase) {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${friendId},receiver_id.eq.me),and(sender_id.eq.me,receiver_id.eq.${friendId})`)
        .order('created_at', { ascending: true });
      return data || [];
    }
    return MOCK_MESSAGES;
  },

  sendMessage: async (senderId: string, receiverId: string, content: string): Promise<void> => {
    if (supabase) {
      await supabase.from('messages').insert({ sender_id: senderId, receiver_id: receiverId, content });
    } else {
      MOCK_MESSAGES.push({
        id: `m_${Date.now()}`,
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        created_at: new Date().toISOString()
      });
    }
  },

  likePost: async (postId: string, userId: string, ownerId: string): Promise<void> => {
    if (supabase) {
      await supabase.from('likes').insert({ post_id: postId, user_id: userId });
    } else {
      const post = MOCK_POSTS.find(p => p.id === postId);
      if (post) {
        post.likes_count = (post.likes_count || 0) + 1;
        post.has_liked = true;
      }
    }
  },

  getNotifications: async (): Promise<Notification[]> => {
    return []; // Simplified for now
  },

  getAllProfiles: async (): Promise<Profile[]> => {
    if (supabase) {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
    return MOCK_PROFILES;
  }
};
