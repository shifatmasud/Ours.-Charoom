
import React, { useEffect, useState, useRef } from 'react';
import { PostCard } from '../Package/PostCard';
import { api } from '../../services/supabaseClient';
import { Post, CurrentUser } from '../../types';
import { CircleNotch, Image as ImageIcon, PaperPlaneRight, Sun, Moon } from '@phosphor-icons/react';
import { Avatar } from '../Core/Avatar';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, commonStyles } from '../../Theme';
import { useTheme } from '../../ThemeContext';

export const Feed: React.FC = () => {
  const { mode, toggleTheme } = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1
      }
    }
  };

  if (loading) {
    return (
      <div style={{ ...commonStyles.flexCenter, minHeight: '100vh', background: theme.colors.surface1 }}>
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <CircleNotch size={24} color={theme.colors.accent} />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      style={commonStyles.pageContainer}
      {...theme.motion.page}
    >
      <div style={{ width: '100%', maxWidth: theme.layout.maxWidth, paddingBottom: '180px', position: 'relative' }}>
        
        {/* Transparent Minimal Header */}
        <div style={{ 
          padding: '24px 24px 12px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
        }}>
           <h1 style={{ fontSize: '28px', color: theme.colors.text1, letterSpacing: '2px' }}>
             Ours<motion.span 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               transition={{ delay: 0.5, duration: 1 }}
               style={{ color: theme.colors.accent }}>.</motion.span>
           </h1>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
             <motion.button
               whileTap={{ scale: 0.9 }}
               onClick={toggleTheme}
               style={{
                 background: 'transparent',
                 border: 'none',
                 color: theme.colors.text1,
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 padding: '8px',
                 cursor: 'pointer'
               }}
             >
               {mode === 'dark' ? <Sun size={20} weight="bold" /> : <Moon size={20} weight="bold" />}
             </motion.button>

             <Link to={`/profile/${currentUser?.id}`}>
                <Avatar src={currentUser?.avatar_url || ''} alt="me" size="sm" />
             </Link>
           </div>
        </div>

        {/* Sticky Floating Input Pill - Enhanced Contrast with Glassy Effect */}
        <div style={{ 
           position: 'sticky', 
           top: '12px', 
           zIndex: 40, 
           padding: '0 16px',
           marginTop: '12px',
           marginBottom: '32px'
        }}>
          <motion.div 
            layout
            initial={{ scale: 0.9, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={theme.motion.gentle}
            style={{ 
              background: theme.colors.inputBg,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: theme.radius.full, 
              padding: '8px 8px 8px 20px', 
              boxShadow: theme.shadow.soft,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              border: `1px solid ${theme.colors.border}`
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
                  color: theme.colors.text1, 
                  fontFamily: theme.fonts.body,
                  fontSize: '14px'
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
                
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.1, backgroundColor: theme.colors.surface3 }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ 
                    padding: '10px', 
                    borderRadius: '50%', 
                    background: preview ? theme.colors.surface3 : 'transparent', 
                    color: preview ? theme.colors.accent : theme.colors.text3,
                    border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <ImageIcon size={20} weight={preview ? 'fill' : 'regular'} />
                </motion.button>

                <motion.button 
                  layout
                  whileTap={{ scale: 0.9 }}
                  onClick={handlePost}
                  disabled={(!caption && !file) || isPosting}
                  style={{ 
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%', 
                    background: (caption || file) ? theme.colors.accent : theme.colors.surface3, 
                    color: (caption || file) ? '#fff' : theme.colors.text1, 
                    border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: (!caption && !file) ? 0.3 : 1,
                  }}
                >
                  {isPosting ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                        <CircleNotch size={16} />
                      </motion.div>
                  ) : (
                      <PaperPlaneRight size={16} weight="fill" />
                  )}
                </motion.button>
            </div>
          </motion.div>
          
          {/* Preview Dropdown */}
          <AnimatePresence>
             {preview && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  style={{ overflow: 'hidden', borderRadius: theme.radius.lg, padding: '0 4px' }}
                >
                   <div style={{ position: 'relative' }}>
                     <img src={preview} alt="prev" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: theme.radius.lg, opacity: 0.8 }} />
                     <button onClick={() => { setPreview(null); setFile(null); }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24 }}>✕</button>
                   </div>
                </motion.div>
             )}
          </AnimatePresence>
        </div>

        {/* Feed List - Increased Gap */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          style={{ display: 'flex', flexDirection: 'column', gap: '64px', padding: '0 16px' }}
        >
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUser={currentUser!} />
          ))}
        </motion.div>

        <div style={{ height: '120px', ...commonStyles.flexCenter, opacity: 0.2 }}>
           <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: theme.colors.text3 }}></div>
        </div>
      </div>
    </motion.div>
  );
};