
import React, { useEffect, useState, useRef } from 'react';
import { PostCard } from '../Package/PostCard';
import { api, supabase } from '../../services/supabaseClient';
import { Post, CurrentUser } from '../../types';
import { CircleNotch, Image as ImageIcon, PaperPlaneRight, Sun, Moon, Bell } from '@phosphor-icons/react';
import { Avatar } from '../Core/Avatar';
import { Button } from '../Core/Button';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '../../Theme';
import { useTheme } from '../../ThemeContext';

export const Feed: React.FC = () => {
  const { mode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Input State
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [user, feedData] = await Promise.all([
          api.getCurrentUser(),
          api.getFeed()
        ]);
        setCurrentUser(user);
        setPosts(feedData);
        
        // Initial Notification Check
        if (user) {
             const notifs = await api.getNotifications();
             setUnreadCount(notifs.filter(n => !n.is_read).length);
        }

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    
    // Realtime Notification Subscription
    let channel: any;
    api.getCurrentUser().then(user => {
       if(!user) return;
       channel = supabase.channel('public:notifications')
       .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
              setUnreadCount(prev => prev + 1);
          }
       )
       .subscribe();
    });

    return () => {
        if(channel) supabase.removeChannel(channel);
    };

  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handlePost = async () => {
    if (!currentUser) return;
    if (!caption && !file) return;

    setIsPosting(true);
    try {
      let imageUrl = '';
      if (file) {
         imageUrl = await api.uploadFile(file);
      } else {
         imageUrl = `https://picsum.photos/seed/${Date.now()}/600/600`; 
      }
      
      await api.createPost(imageUrl, caption, currentUser.id);
      
      const newPost: Post = {
        id: `temp_${Date.now()}`,
        user_id: currentUser.id,
        image_url: preview || imageUrl,
        caption: caption,
        created_at: new Date().toISOString(),
        profiles: currentUser,
        likes_count: 0,
        has_liked: false,
        comments_count: 0
      };
      setPosts(prev => [newPost, ...prev]);
      setCaption('');
      setFile(null);
      setPreview(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPosting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: DS.Color.Base.Surface[1] }}>
        <CircleNotch size={32} className="animate-spin" color={DS.Color.Accent.Surface} />
      </div>
    );
  }

  return (
    <div style={{ 
      background: DS.Color.Base.Surface[1], 
      minHeight: '100vh', 
      width: '100%',
      display: 'flex', 
      justifyContent: 'center' 
    }}>
      <div style={{ width: '100%', maxWidth: '500px', paddingBottom: '100px' }}>
        
        {/* Header */}
        <header style={{ 
          padding: '24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: DS.Color.Base.Surface[1], // Opaque for scroll
        }}>
           <h1 style={{ fontSize: '32px', color: DS.Color.Base.Content[1], ...DS.Type.Expressive.Display }}>
             OURS<span style={{ color: DS.Color.Accent.Surface }}>.</span>
           </h1>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <Button variant="ghost" size="icon" onClick={() => navigate('/activity')} style={{ position: 'relative' }}>
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span style={{ 
                        position: 'absolute', top: 6, right: 6, 
                        width: '8px', height: '8px', 
                        background: DS.Color.Accent.Surface, 
                        borderRadius: '50%',
                        border: `1px solid ${DS.Color.Base.Surface[1]}`
                    }} />
                )}
             </Button>
             <Button variant="ghost" size="icon" onClick={toggleTheme}>
               {mode === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
             </Button>
             <Link to={`/profile/${currentUser?.id}`}>
                <Avatar src={currentUser?.avatar_url || ''} alt="me" size="sm" />
             </Link>
           </div>
        </header>

        {/* Input Area */}
        <div style={{ padding: '0 16px 32px 16px' }}>
          <motion.div 
            layout
            style={{ 
              background: DS.Color.Base.Surface[2],
              borderRadius: DS.Radius.Full, // Peel/Pill shape
              padding: '8px 8px 8px 16px', 
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              border: `1px solid ${DS.Color.Base.Border}`
            }}
          >
            <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Share a moment..."
                style={{ 
                  flex: 1, 
                  background: 'transparent', 
                  border: 'none', 
                  outline: 'none', 
                  color: DS.Color.Base.Content[1], 
                  ...DS.Type.Readable.Body
                }}
            />
              
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleFileSelect}
                />
                
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon size={20} weight={preview ? 'fill' : 'regular'} color={preview ? DS.Color.Accent.Surface : undefined} />
                </Button>

                <Button 
                  variant={caption || file ? "primary" : "secondary"} 
                  size="icon"
                  onClick={handlePost}
                  disabled={(!caption && !file) || isPosting}
                >
                  {isPosting ? <CircleNotch className="animate-spin" /> : <PaperPlaneRight size={18} weight="fill" />}
                </Button>
            </div>
          </motion.div>
          
          <AnimatePresence>
             {preview && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  style={{ overflow: 'hidden', borderRadius: DS.Radius.M }}
                >
                   <div style={{ position: 'relative' }}>
                     <img src={preview} alt="prev" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: DS.Radius.M }} />
                     <button onClick={() => { setPreview(null); setFile(null); }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24 }}>✕</button>
                   </div>
                </motion.div>
             )}
          </AnimatePresence>
        </div>

        {/* Feed Stream */}
        <div style={{ padding: '0 16px' }}>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUser={currentUser!} />
          ))}
        </div>

        <div style={{ height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.3 }}>
           <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: DS.Color.Base.Content[3] }}></div>
        </div>
      </div>
    </div>
  );
};
