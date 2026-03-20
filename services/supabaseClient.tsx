
import { createClient } from '@supabase/supabase-js';
import { Post, Message, Notification, Profile, CurrentUser, Comment } from '../types';
import { getNotifications, markNotificationAsRead, sendNotification } from './api/notifications';
import { signUpWithEmail, signInWithPassword, resetPassword, updatePassword, signOut, getCurrentUser, updateCurrentUser } from './api/auth';
import { getUserProfile, getAllProfiles } from './api/profiles';
import { getFeed, getPost, getUserPosts, createPost, deletePost, likePost, subscribeToPostInteractions } from './api/posts';
import { getComments, addComment, deleteComment } from './api/comments';
import { followUser, unfollowUser } from './api/interactions';
import { getMessages, getLastMessage, getRecentConversations, sendMessage, subscribeToMessages, subscribeToUserMessages } from './api/messaging';
import { uploadFile } from './api/storage';

// --- Configuration ---
const DEFAULT_URL = 'https://lezvekpflqbxornefbwh.supabase.co';
const RAW_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
// Normalize URL: remove trailing slash if present
const SUPABASE_URL = RAW_URL.endsWith('/') ? RAW_URL.slice(0, -1) : RAW_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlenZla3BmbHFieG9ybmVmYndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MDM1OTEsImV4cCI6MjA3OTI3OTU5MX0._fN9MxAivt_GyYv81lR7VJUShAPnYQ5txynHxwyrftw';

export const isDefaultUrl = SUPABASE_URL === DEFAULT_URL;
export const IS_MOCK_MODE = typeof window !== 'undefined' && localStorage.getItem('supabase_mock_mode') === 'true';

// --- Mock Data ---
export const MOCK_USER: CurrentUser = {
    id: 'mock-user-id',
    username: 'demo_user',
    full_name: 'Demo User',
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
    bio: 'This is a demo account because the default Supabase project is unreachable.',
    followers_count: 42,
    following_count: 12
};

export const MOCK_POSTS: Post[] = [
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
export const isConnectionError = (err: any) => {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return msg.includes('failed to fetch') || 
         msg.includes('network error') ||
         msg.includes('load failed') ||
         msg.includes('timeout') ||
         err.name === 'TypeError' && msg.includes('fetch');
};

export const handleSupabaseError = (err: any) => {
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
  getNotifications,
  markNotificationAsRead,
  sendNotification,
  signUpWithEmail,
  signInWithPassword,
  resetPassword,
  updatePassword,
  signOut,
  getCurrentUser,
  updateCurrentUser,
  getUserProfile,
  getAllProfiles,
  getFeed,
  getPost,
  getUserPosts,
  createPost,
  deletePost,
  likePost,
  getComments,
  addComment,
  deleteComment,
  followUser,
  unfollowUser,
  getMessages,
  getLastMessage,
  getRecentConversations,
  sendMessage,
  subscribeToMessages,
  subscribeToUserMessages,
  subscribeToPostInteractions,
  uploadFile
};
