
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ChatCircle, PaperPlaneTilt, PaperPlaneRight } from '@phosphor-icons/react';
import { Avatar } from '../Core/Avatar';
import { Post, CurrentUser, Comment } from '../../types';
import { api } from '../../services/supabaseClient';
import { Link } from 'react-router-dom';
import { theme, commonStyles } from '../../Theme';
import { SlotCounter } from '../Core/SlotCounter';

// --- Particle Burst Component ---
const LikeParticles = () => {
  const particles = Array.from({ length: 12 }); // More particles for better burst
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      {particles.map((_, i) => {
        const angle = (i / particles.length) * 360;
        const radius = 25 + Math.random() * 15; // Random variation
        return (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
            animate={{ 
              x: Math.cos(angle * Math.PI / 180) * radius, 
              y: Math.sin(angle * Math.PI / 180) * radius,
              opacity: 0,
              scale: 0
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: Math.random() > 0.5 ? '4px' : '6px', // Varied sizes
              height: Math.random() > 0.5 ? '4px' : '6px',
              borderRadius: '50%',
              backgroundColor: theme.colors.accent,
              boxShadow: `0 0 6px ${theme.colors.accent}`, // Glow
              marginTop: '-3px',
              marginLeft: '-3px'
            }}
          />
        );
      })}
    </div>
  );
};

interface PostCardProps {
  post: Post;
  currentUser: CurrentUser;
}

export const PostCard: React.FC<PostCardProps> = ({ post, currentUser }) => {
  const [isLiked, setIsLiked] = useState(post.has_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const handleDoubleTap = () => {
    if (!isLiked) toggleLike();
    setShowHeartOverlay(true);
    setTimeout(() => setShowHeartOverlay(false), 800);
  };

  const toggleLike = async () => {
    // ACTION SEQUENCE: UI First (Optimistic)
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);
    
    if (newLikedState) {
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 800);
      await api.likePost(post.id, currentUser.id, post.user_id);
    }
  };

  const toggleComments = async () => {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      const data = await api.getComments(post.id);
      setComments(data);
      setLoadingComments(false);
    }
    setShowComments(!showComments);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    const text = newComment;
    setNewComment('');
    try {
      const savedComment = await api.addComment(post.id, currentUser.id, text);
      setComments(prev => [...prev, savedComment]);
    } catch (e) {
      console.error("Failed to comment", e);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/#/post/${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
       const btn = document.getElementById(`share-${post.id}`);
       if(btn) {
           const originalColor = btn.style.color;
           btn.style.color = theme.colors.accent;
           setTimeout(() => btn.style.color = originalColor, 1000);
       }
    });
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: theme.motion.gentle }
  };

  return (
    <motion.article 
      variants={itemVariants}
      style={{ width: '100%', position: 'relative', marginBottom: '64px' }}
    >
      {/* Content Card */}
      <motion.div 
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: theme.radius.xl,
          overflow: 'hidden',
          boxShadow: theme.shadow.card,
          cursor: 'pointer',
          backgroundColor: theme.colors.surface2,
        }}
        onDoubleClick={handleDoubleTap}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.99 }}
        transition={theme.motion.gentle}
        layout
      >
        <img 
          src={post.image_url} 
          alt="Moment" 
          style={{ width: '100%', height: 'auto', display: 'block' }} 
        />
        
        <AnimatePresence>
          {showHeartOverlay && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={theme.motion.spring}
              style={{ 
                position: 'absolute', inset: 0, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                pointerEvents: 'none',
                background: 'rgba(0,0,0,0.05)'
              }}
            >
              <Heart weight="fill" color={theme.colors.accent} size={100} style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* Minimal Metadata & Actions */}
      <div style={{ marginTop: '16px', padding: '0 8px' }}>
        
        {/* Author & Time */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
           <Link to={`/profile/${post.user_id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <Avatar src={post.profiles?.avatar_url || ''} alt="user" size="sm" />
              <span style={{ color: theme.colors.text1, fontWeight: 600, fontSize: '14px' }}>{post.profiles?.username}</span>
           </Link>
           <span style={{ fontSize: '10px', color: theme.colors.text3, letterSpacing: '0.5px' }}>NOW</span>
        </div>

        {/* Caption */}
        <p style={{ color: theme.colors.text2, fontSize: '15px', lineHeight: 1.5, fontFamily: theme.fonts.body, fontWeight: 400, marginBottom: '16px' }}>
           {post.caption}
        </p>

        {/* Floating Actions */}
        <div style={{ ...commonStyles.flexBetween }}>
           <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
             <motion.button 
               whileTap={{ scale: 0.8 }}
               transition={theme.motion.tactile}
               onClick={toggleLike} 
               style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: 0, color: isLiked ? theme.colors.accent : theme.colors.text3, position: 'relative', cursor: 'pointer' }}
             >
               {/* Container for Icon + Particles ensuring they are centered relative to the ICON, not the button including text */}
               <div style={{ position: 'relative', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   {showParticles && <LikeParticles />}
                   <motion.div
                     key={isLiked ? 'liked' : 'unliked'}
                     initial={{ scale: 0.6 }}
                     animate={{ scale: 1 }}
                     transition={theme.motion.tactile}
                     style={{ position: 'relative', zIndex: 2 }}
                   >
                      <Heart 
                        size={24} 
                        weight={isLiked ? "fill" : "light"} 
                      />
                   </motion.div>
               </div>
               
               {likesCount > 0 && (
                 <SlotCounter value={likesCount} color="currentColor" fontSize="13px" />
               )}
             </motion.button>

             <motion.button 
               whileTap={{ scale: 0.8 }}
               transition={theme.motion.tactile}
               onClick={toggleComments} 
               style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: 0, color: theme.colors.text3, cursor: 'pointer' }}
             >
                <ChatCircle size={24} weight="light" />
                {(comments.length > 0 || (post.comments_count || 0) > 0) && (
                  <SlotCounter value={comments.length || post.comments_count || 0} color="currentColor" fontSize="13px" />
                )}
             </motion.button>
           </div>
           
           <motion.button 
             id={`share-${post.id}`}
             whileTap={{ scale: 0.8 }}
             transition={theme.motion.tactile}
             onClick={handleShare} 
             style={{ background: 'none', border: 'none', color: theme.colors.text3, padding: 0, cursor: 'pointer' }}
           >
              <PaperPlaneTilt size={24} weight="light" />
           </motion.button>
        </div>
      </div>

      {/* Minimal Comment Expansion */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={theme.motion.gentle}
            style={{ overflow: 'hidden', marginTop: '24px' }}
          >
             <div style={{ padding: '0 8px' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                 {loadingComments ? (
                   <div style={{ fontSize: '11px', color: theme.colors.text3 }}>loading...</div>
                 ) : comments.length > 0 ? (
                   comments.map((comment, i) => (
                     <motion.div 
                       key={comment.id} 
                       initial={{ opacity: 0, x: -10 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: i * 0.05 }}
                       style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}
                     >
                       <span style={{ color: theme.colors.text3, fontWeight: 600, fontSize: '12px' }}>{comment.profile?.username}</span>
                       <p style={{ color: theme.colors.text2, fontSize: '13px', fontFamily: theme.fonts.raw, margin: 0 }}>{comment.content}</p>
                     </motion.div>
                   ))
                 ) : (
                   <div style={{ fontSize: '11px', color: theme.colors.text3 }}>echo chamber.</div>
                 )}
               </div>
               
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: `1px solid ${theme.colors.surface3}`, paddingBottom: '8px' }}>
                 <input 
                   type="text" 
                   placeholder="reply..." 
                   value={newComment}
                   onChange={(e) => setNewComment(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                   style={{ ...commonStyles.inputReset, fontSize: '14px', padding: '0' }}
                 />
                 <motion.button 
                   whileTap={{ scale: 0.9 }}
                   onClick={handleAddComment} 
                   disabled={!newComment.trim()}
                   style={{ 
                     background: 'none',
                     color: newComment.trim() ? theme.colors.accent : theme.colors.surface3,
                     border: 'none', padding: 0
                   }}
                 >
                   <PaperPlaneRight size={20} weight={newComment.trim() ? "fill" : "regular"} />
                 </motion.button>
               </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};
