

export interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  full_name?: string;
  bio?: string;
  followers_count?: number;
  following_count?: number;
  is_following?: boolean; // Virtual field for UI context
  is_admin?: boolean;
}

export interface CurrentUser extends Profile {}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile; // Joined data
}

export interface Post {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  created_at: string;
  profiles?: Profile; // Joined data
  likes_count?: number;
  has_liked?: boolean; // Virtual field for UI
  comments_count?: number;
  comments?: Comment[]; // Loaded on demand or partial
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  type?: 'text' | 'image' | 'audio';
  media_url?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'follow';
  reference_id: string;
  is_read: boolean;
  created_at: string;
  sender_profile?: Profile; // Virtual/Joined
}