
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { api } from '../../services/supabaseClient';
import { CurrentUser, Post, Profile as UserProfile } from '../../types';
import { Avatar } from '../Core/Avatar';
import { SquaresFour, ChatCircleText, CaretLeft, X, SignOut } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, commonStyles } from '../../Theme';
import { SlotCounter } from '../Core/SlotCounter';

export const Profile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const myUser = await api.getCurrentUser();
        setCurrentUser(myUser);

        const targetId = userId || myUser.id;
        
        const [fetchedProfile, fetchedPosts] = await Promise.all([
          api.getUserProfile(targetId),
          api.getUserPosts(targetId)
        ]);

        setProfileUser(fetchedProfile);
        setPosts(fetchedPosts);
        
        if (targetId === myUser.id) {
          setEditName(fetchedProfile.full_name || '');
          setEditBio(fetchedProfile.bio || '');
        }

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [userId]);

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    try {
      const updatedUser = await api.updateCurrentUser({
        full_name: editName,
        bio: editBio
      });
      setProfileUser(updatedUser);
      setCurrentUser(updatedUser);
      setIsEditing(false);
    } catch (e) {
      console.error("Failed to update profile", e);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser || !profileUser) return;
    try {
      if (profileUser.is_following) {
        await api.unfollowUser(currentUser.id, profileUser.id);
        setProfileUser(prev => prev ? ({ ...prev, is_following: false, followers_count: (prev.followers_count || 1) - 1 }) : null);
      } else {
        await api.followUser(currentUser.id, profileUser.id);
        setProfileUser(prev => prev ? ({ ...prev, is_following: true, followers_count: (prev.followers_count || 0) + 1 }) : null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMessage = () => {
    if (profileUser) {
      navigate(`/messages/${profileUser.id}`);
    }
  };

  if (loading) {
    return <div style={{ ...commonStyles.flexCenter, height: '100vh', color: theme.colors.text3 }}>Loading...</div>;
  }

  if (!profileUser || !currentUser) return null;

  const isMyProfile = profileUser.id === currentUser.id;

  return (
    // Removed motion page transitions from root to keep header static
    <div 
      style={commonStyles.pageContainer}
    >
      <div style={{ width: '100%', maxWidth: theme.layout.maxWidth, paddingBottom: '180px' }}>
        
        {/* Back Button */}
        <div style={{ padding: '24px' }}>
             <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: theme.colors.text1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
               <CaretLeft size={20} /> Back
             </button>
        </div>

        {/* Profile Header - Static without animations */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px 32px 24px' }}>
            
            <div>
              <Avatar src={profileUser.avatar_url} alt={profileUser.username} size="xl" bordered style={{ width: '110px', height: '110px', marginBottom: '24px' }} />
            </div>
            
            {/* Stats with Slot Counters */}
            <div 
              style={{ display: 'flex', gap: '40px', marginBottom: '32px' }}
            >
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontFamily: theme.fonts.display, fontSize: '24px', color: theme.colors.text1, display: 'flex', justifyContent: 'center' }}>
                   <SlotCounter value={posts.length} fontSize="24px" />
                </div>
                <span style={{ fontSize: '11px', color: theme.colors.text3, textTransform: 'uppercase', letterSpacing: '1px' }}>Posts</span>
              </div>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontFamily: theme.fonts.display, fontSize: '24px', color: theme.colors.text1, display: 'flex', justifyContent: 'center' }}>
                    <SlotCounter value={profileUser.followers_count || 0} fontSize="24px" />
                </div>
                <span style={{ fontSize: '11px', color: theme.colors.text3, textTransform: 'uppercase', letterSpacing: '1px' }}>Followers</span>
              </div>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontFamily: theme.fonts.display, fontSize: '24px', color: theme.colors.text1, display: 'flex', justifyContent: 'center' }}>
                    <SlotCounter value={profileUser.following_count || 0} fontSize="24px" />
                </div>
                <span style={{ fontSize: '11px', color: theme.colors.text3, textTransform: 'uppercase', letterSpacing: '1px' }}>Following</span>
              </div>
            </div>

            {/* User Info & Actions */}
            <div style={{ width: '100%' }}>
                <div 
                  style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px' }}
                >
                  <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', color: theme.colors.text1 }}>{profileUser.full_name || profileUser.username}</h1>
                    <p style={{ 
                      color: theme.colors.text2, 
                      whiteSpace: 'pre-wrap', 
                      fontSize: '15px', 
                      lineHeight: 1.6, 
                      fontFamily: theme.fonts.body, // Explicitly use Inter Body font for readability
                      fontWeight: 400,
                      maxWidth: '80%', 
                      margin: '0 auto' 
                    }}>
                      {profileUser.bio || "Just floating in the void."}
                    </p>
                  </div>
                  
                  {isMyProfile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button 
                        onClick={() => setIsEditing(true)}
                        style={{ 
                          width: '100%', 
                          background: theme.colors.surface2, 
                          border: `1px solid ${theme.colors.border}`, // Used border variable for better contrast
                          color: theme.colors.text1, 
                          padding: '12px', 
                          borderRadius: theme.radius.full, 
                          fontWeight: 600, 
                          fontSize: '14px', 
                          cursor: 'pointer', 
                          transition: 'all 0.2s' 
                        }}
                      >
                        Edit Profile
                      </button>
                      
                      <button 
                        onClick={() => api.signOut()}
                        style={{ 
                          width: '100%', 
                          background: 'transparent', 
                          border: `1px solid ${theme.colors.danger}`, 
                          color: theme.colors.danger, 
                          padding: '12px', 
                          borderRadius: theme.radius.full, 
                          fontWeight: 600, 
                          fontSize: '14px', 
                          cursor: 'pointer', 
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <SignOut size={18} weight="bold" />
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                      <button 
                        onClick={handleFollowToggle}
                        style={{ 
                          padding: '12px 32px', borderRadius: theme.radius.full, fontWeight: 600, fontSize: '14px', 
                          border: 'none', cursor: 'pointer',
                          background: profileUser.is_following ? theme.colors.surface3 : theme.colors.accent,
                          color: profileUser.is_following ? theme.colors.text1 : 'white'
                        }}
                      >
                        {profileUser.is_following ? 'Following' : 'Follow'}
                      </button>
                      <button 
                        onClick={handleMessage}
                        style={{ background: theme.colors.surface2, border: `1px solid ${theme.colors.surface3}`, color: theme.colors.text1, padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <ChatCircleText weight="fill" size={20} />
                      </button>
                    </div>
                  )}
                </div>
            </div>
        </div>

        {/* Grid - Seamless No Divider */}
        <div style={{ paddingTop: '0' }}>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0' }}>
             {posts.map((post, i) => (
               <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  key={post.id} 
                  onClick={() => navigate(`/post/${post.id}`)}
                  style={{ position: 'relative', aspectRatio: '1/1', cursor: 'pointer', overflow: 'hidden', backgroundColor: theme.colors.surface2 }}
               >
                 <img 
                   src={post.image_url} 
                   alt="User Post" 
                   style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }} 
                 />
               </motion.div>
             ))}
           </div>
           {posts.length === 0 && (
             <div style={{ padding: '64px 0', textAlign: 'center', color: theme.colors.text3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <SquaresFour size={32} weight="thin" />
                <p style={{ fontSize: '14px' }}>Empty canvas.</p>
             </div>
           )}
        </div>
      </div>

      {/* Edit Profile Overlay - Portaled to Body */}
      {createPortal(
        <AnimatePresence>
          {isEditing && (
             <>
               {/* Backdrop */}
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 onClick={() => setIsEditing(false)}
                 style={{ 
                   position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', 
                   backdropFilter: 'blur(8px)', zIndex: 2000 
                 }}
               />
               {/* Modal */}
               <motion.div
                 initial={{ y: '100%', opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 exit={{ y: '100%', opacity: 0 }}
                 transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                 style={{ 
                   position: 'fixed', bottom: 0, left: 0, right: 0, 
                   background: theme.colors.surface2,
                   borderTopLeftRadius: theme.radius.xl,
                   borderTopRightRadius: theme.radius.xl,
                   padding: '24px 24px 48px 24px',
                   zIndex: 2001,
                   maxWidth: theme.layout.maxWidth,
                   margin: '0 auto',
                   // Subtle top separator only
                   borderTop: `1px solid ${theme.colors.surface3}`
                 }}
               >
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                     <h3 style={{ fontSize: '18px', fontWeight: 600, color: theme.colors.text1 }}>Edit Profile</h3>
                     <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: theme.colors.text1 }}>
                       <X size={24} />
                     </button>
                   </div>

                   <div style={{ marginBottom: '24px' }}>
                       <label style={{ fontSize: '11px', color: theme.colors.text3, textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Name</label>
                       <input 
                         type="text" 
                         value={editName}
                         onChange={(e) => setEditName(e.target.value)}
                         style={{ 
                            ...commonStyles.inputReset, 
                            background: theme.colors.inputBg, 
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: `1px solid ${theme.colors.border}`, 
                            borderRadius: theme.radius.md, 
                            padding: '16px' 
                          }}
                       />
                   </div>
                   
                   <div style={{ marginBottom: '32px' }}>
                       <label style={{ fontSize: '11px', color: theme.colors.text3, textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Bio</label>
                       <textarea 
                         value={editBio}
                         onChange={(e) => setEditBio(e.target.value)}
                         style={{ 
                            ...commonStyles.inputReset, 
                            background: theme.colors.inputBg, 
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: `1px solid ${theme.colors.border}`, 
                            borderRadius: theme.radius.md, 
                            padding: '16px', 
                            resize: 'none', 
                            height: '100px' 
                          }}
                       />
                   </div>

                   <button 
                     onClick={handleSaveProfile}
                     style={{ 
                       width: '100%', background: theme.colors.accent, color: 'white', 
                       padding: '16px', borderRadius: theme.radius.full, border: 'none', 
                       fontWeight: 600, cursor: 'pointer', fontSize: '16px' 
                     }}
                   >
                     Save Changes
                   </button>
               </motion.div>
             </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};