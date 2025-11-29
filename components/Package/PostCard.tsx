
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ChatCircle, PaperPlaneTilt, PaperPlaneRight, WarningCircle } from '@phosphor-icons/react';
import { Avatar } from '../Core/Avatar';
import { Button, ParticleBurst } from '../Core/Button';
import { SlotCounter } from '../Core/SlotCounter';
import { Post, CurrentUser, Comment } from '../../types';
import { api } from '../../services/supabaseClient';
import { Link } from 'react-router-dom';
import { DS } from '../../Theme';

interface PostCardProps {
  post: Post;
  currentUser: CurrentUser;
}

const LIKE_COLOR = '#FF4F1F'; // Reddish Orange (Accent)

export const PostCard: React.FC<PostCardProps> = ({ post, currentUser }) => {
  const [isLiked, setIsLiked] = useState(post.has_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [showIconBurst, setShowIconBurst] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleDoubleTap = () => {
    if (!isLiked) toggleLike();
    setShowHeartOverlay(true);
    setTimeout(() => setShowHeartOverlay(false), 800);
  };

  const toggleLike = async () => {
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);
    
    if (newLikedState) {
      setShowIconBurst(true);
      setTimeout(() => setShowIconBurst(false), 500);
    }

    try {
       await api.likePost(post.id, currentUser.id, post.user_id);
    } catch (e) {
       console.error("Failed to toggle like", e);
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

  return (
    <motion.article 
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={DS.Motion.Spring.Gentle}
      style={{ width: '100%', position: 'relative', marginBottom: '64px' }}
    >
      {/* Media Component - COVER Sizing Mode */}
      <motion.div 
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1/1', // Strictly square
          borderRadius: DS.Radius.L,
          overflow: 'hidden',
          backgroundColor: DS.Color.Base.Surface[2],
          marginBottom: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onDoubleClick={handleDoubleTap}
        whileHover={{ scale: 1.005 }}
        transition={DS.Motion.Spring.Gentle}
      >
        {!imageError ? (
          <img 
            src={post.image_url} 
            alt="Moment" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            onError={() => setImageError(true)}
            crossOrigin="anonymous"
            loading="lazy"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: DS.Color.Base.Content[3] }}>
             <WarningCircle size={32} />
             <span style={{ fontSize: '12px' }}>Image failed to load</span>
          </div>
        )}
        
        <AnimatePresence>
          {showHeartOverlay && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              style={{ 
                position: 'absolute', inset: 0, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                pointerEvents: 'none'
              }}
            >
              <Heart weight="fill" color={LIKE_COLOR} size={96} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* Metadata Section */}
      <div style={{ padding: '0 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
           <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Link to={`/profile/${post.user_id}`} style={{ textDecoration: 'none' }}>
                   <Avatar src={post.profiles?.avatar_url || ''} alt="user" size="sm" />
                </Link>
                <Link to={`/profile/${post.user_id}`} style={{ textDecoration: 'none', color: DS.Color.Base.Content[1], ...DS.Type.Readable.Label }}>
                   {post.profiles?.username}
                </Link>
              </div>
              <p style={{ color: DS.Color.Base.Content[2], ...DS.Type.Expressive.Quote, fontSize: '16px' }}>
                 {post.caption}
              </p>
           </div>
           <span style={{ color: DS.Color.Base.Content[3], fontSize: '11px', letterSpacing: '0.5px' }}>NOW</span>
        </div>

        {/* Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
           <div style={{ display: 'flex', gap: '8px' }}>
             <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleLike} 
                noBurst 
                style={{ color: isLiked ? LIKE_COLOR : DS.Color.Base.Content[1] }}
             >
               <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Heart size={22} weight={isLiked ? "fill" : "regular"} color={isLiked ? LIKE_COLOR : undefined} />
                  <AnimatePresence>
                    {showIconBurst && <ParticleBurst color={LIKE_COLOR} />}
                  </AnimatePresence>
               </div>
               <SlotCounter value={likesCount} />
             </Button>

             <Button variant="ghost" size="sm" onClick={toggleComments}>
                <ChatCircle size={22} />
                <SlotCounter value={comments.length || post.comments_count || 0} />
             </Button>
           </div>
           
           <Button variant="ghost" size="icon">
              <PaperPlaneTilt size={22} />
           </Button>
        </div>

        {/* Comments Expansion */}
        <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', marginTop: '16px' }}
          >
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '8px' }}>
               {loadingComments ? (
                 <div style={{ fontSize: '12px', color: DS.Color.Base.Content[3] }}>Loading thoughts...</div>
               ) : comments.length > 0 ? (
                 comments.map((comment, i) => (
                   <div key={comment.id} style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
                     <span style={{ color: DS.Color.Base.Content[2], fontWeight: 600 }}>{comment.profile?.username}</span>
                     <span style={{ color: DS.Color.Base.Content[2] }}>{comment.content}</span>
                   </div>
                 ))
               ) : (
                 <div style={{ fontSize: '12px', color: DS.Color.Base.Content[3] }}>Echo chamber.</div>
               )}
               
               <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                 <input 
                   placeholder="Write a comment..." 
                   value={newComment}
                   onChange={(e) => setNewComment(e.target.value)}
                   style={{ 
                     flex: 1, background: 'transparent', border: 'none', outline: 'none',
                     color: DS.Color.Base.Content[1], ...DS.Type.Readable.Body, fontSize: '13px'
                   }}
                 />
                 <Button variant="ghost" size="icon" onClick={handleAddComment} disabled={!newComment.trim()}>
                    <PaperPlaneRight size={16} weight="fill" color={newComment.trim() ? DS.Color.Accent.Surface : DS.Color.Base.Content[3]} />
                 </Button>
               </div>
             </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
};
