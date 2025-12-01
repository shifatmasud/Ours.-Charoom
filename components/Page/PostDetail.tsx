
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/supabaseClient';
import { Post, CurrentUser } from '../../types';
import { PostCard } from '../Package/PostCard';
import { CaretLeft, CircleNotch } from '@phosphor-icons/react';
import { DS } from '../../Theme';
import { commonStyles, theme } from '../../Theme';

export const PostDetail: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!postId) return;
      try {
        setLoading(true);
        const [user, postData] = await Promise.all([
          api.getCurrentUser(),
          api.getPost(postId)
        ]);
        setCurrentUser(user);
        setPost(postData);
      } catch (e) {
        console.error("Failed to load post", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [postId]);

  const handleBack = () => {
     if (window.history.length > 2) {
         navigate(-1);
     } else {
         navigate('/', { replace: true });
     }
  };

  if (loading) {
    return (
      <div style={{ ...commonStyles.flexCenter, height: '100vh', width: '100%', background: theme.colors.surface1 }}>
        <CircleNotch size={32} className="animate-spin" color={theme.colors.accent} />
      </div>
    );
  }

  if (!post || !currentUser) {
    return (
      <div style={{ ...commonStyles.flexCenter, height: '100vh', width: '100%', flexDirection: 'column', background: theme.colors.surface1, color: theme.colors.text2 }}>
        <p>Moment not found.</p>
        <button onClick={() => navigate('/')} style={{ marginTop: '16px', color: theme.colors.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Return Home</button>
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
        <div style={{ 
          padding: '24px', 
          display: 'flex', 
          alignItems: 'center',
          gap: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: DS.Color.Base.Surface[1],
        }}>
           <button 
             onClick={handleBack} 
             style={{ 
               background: 'none', 
               border: 'none', 
               color: DS.Color.Base.Content[1], 
               display: 'flex', 
               alignItems: 'center', 
               gap: '8px', 
               cursor: 'pointer',
               ...DS.Type.Readable.Label
             }}
           >
             <CaretLeft size={20} /> BACK
           </button>
           <h2 style={{ ...DS.Type.Expressive.Display, fontSize: '20px', color: DS.Color.Base.Content[1] }}>Moment</h2>
        </div>

        {/* Post Content */}
        <div style={{ padding: '0 16px' }}>
          <PostCard post={post} currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
};
