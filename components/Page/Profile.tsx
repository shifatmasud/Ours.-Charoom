
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { api } from '../../services/supabaseClient';
import { CurrentUser, Post, Profile as UserProfile } from '../../types';
import { Avatar } from '../Core/Avatar';
import { SquaresFour, ChatCircleText, CaretLeft, X, SignOut, Camera } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, commonStyles, DS } from '../../Theme';
import { SlotCounter } from '../Core/SlotCounter';
import { Loader } from '../Core/Loader';

import { useAuth } from '../../contexts/AuthContext';

export const Profile: React.FC = () => {
  const { user: currentUser, setUser } = useAuth();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  
  // Avatar Upload State
  const [editAvatar, setEditAvatar] = useState<File | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    let mounted = true;
    let profileTimeout: any;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // 5s safety timeout
        profileTimeout = setTimeout(() => {
          if (mounted) {
            console.warn('Profile: Data loading timed out');
            setLoading(false);
          }
        }, 5000);

        const targetId = userId || currentUser.id;
        
        const [fetchedProfile, fetchedPosts] = await Promise.all([
          api.getUserProfile(targetId),
          api.getUserPosts(targetId)
        ]);

        if (mounted) {
          setProfileUser(fetchedProfile);
          setPosts(fetchedPosts);
          
          if (targetId === currentUser.id) {
            setEditName(fetchedProfile.full_name || '');
            setEditBio(fetchedProfile.bio || '');
          }
        }

      } catch (e) {
        console.error('Profile: Error loading data:', e);
      } finally {
        if (mounted) setLoading(false);
        if (profileTimeout) clearTimeout(profileTimeout);
      }
    };
    loadData();

    return () => {
      mounted = false;
      if (profileTimeout) clearTimeout(profileTimeout);
    };
  }, [userId, currentUser]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setEditAvatar(file);
          setPreviewAvatar(URL.createObjectURL(file));
      }
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    try {
      let avatarUrl = currentUser.avatar_url;
      
      if (editAvatar) {
         avatarUrl = await api.uploadFile(editAvatar);
      }

      const updatedUser = await api.updateCurrentUser({
        full_name: editName,
        bio: editBio,
        avatar_url: avatarUrl
      });
      setProfileUser(updatedUser);
      setUser(updatedUser);
      setIsEditing(false);
      
      // Reset upload state
      setEditAvatar(null);
      setPreviewAvatar(null);
    } catch (e) {
      console.error("Failed to update profile", e);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser || !profileUser) return;
    const wasFollowing = profileUser.is_following;
    
    // Optimistic render
    setProfileUser(prev => prev ? ({ 
      ...prev, 
      is_following: !wasFollowing, 
      followers_count: (prev.followers_count || 0) + (wasFollowing ? -1 : 1) 
    }) : null);

    try {
      if (wasFollowing) {
        await api.unfollowUser(currentUser.id, profileUser.id);
      } else {
        await api.followUser(currentUser.id, profileUser.id, currentUser.username);
      }
    } catch (e) {
      console.error(e);
      // Revert optimistic render
      setProfileUser(prev => prev ? ({ 
        ...prev, 
        is_following: wasFollowing, 
        followers_count: (prev.followers_count || 0) + (wasFollowing ? 1 : -1) 
      }) : null);
    }
  };

  const handleMessage = () => {
    if (profileUser) {
      navigate(`/messages/${profileUser.id}`);
    }
  };

  if (loading) {
    return <Loader fullscreen label="FETCHING PROFILE" />;
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
        <div style={{ padding: '32px 24px 0 24px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
             <button 
               onClick={() => navigate(-1)} 
               style={{ 
                 background: 'none', 
                 border: 'none', 
                 color: theme.colors.text1, 
                 display: 'flex', 
                 alignItems: 'center', 
                 cursor: 'pointer', 
                 opacity: 0.4,
                 transition: 'opacity 0.2s'
               }}
               onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
               onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
             >
               <CaretLeft size={20} weight="bold" />
             </button>
        </div>

        {/* Profile Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px 40px 24px' }}>
            
            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <Avatar src={profileUser.avatar_url} alt={profileUser.username} size="xl" style={{ width: '110px', height: '110px' }} />
            </div>
            
            {/* User Info */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h1 style={{ 
                ...DS.Type.Readable.Label,
                fontSize: '24px', 
                fontWeight: 700,
                marginBottom: '4px', 
                color: theme.colors.text1,
                letterSpacing: '-0.02em'
              }}>
                {profileUser.full_name || profileUser.username}
              </h1>
              <p style={{ 
                ...DS.Type.Readable.Body,
                color: theme.colors.text2, 
                fontSize: '13px',
                maxWidth: '280px',
                margin: '0 auto',
                opacity: 0.7,
                lineHeight: '1.4'
              }}>
                {profileUser.bio || ""}
              </p>
            </div>

            {/* Stats - Ultra Minimalist */}
            <div 
              style={{ 
                display: 'flex', 
                gap: '40px', 
                marginBottom: '40px',
                width: '100%',
                justifyContent: 'center'
              }}
            >
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ ...DS.Type.Readable.Label, fontSize: '18px', fontWeight: 700, color: theme.colors.text1 }}>
                   <SlotCounter value={posts.length} fontSize="18px" fontWeight={700} />
                </div>
                <span style={{ fontSize: '10px', color: theme.colors.text3, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>posts</span>
              </div>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ ...DS.Type.Readable.Label, fontSize: '18px', fontWeight: 700, color: theme.colors.text1 }}>
                    <SlotCounter value={profileUser.followers_count || 0} fontSize="18px" fontWeight={700} />
                </div>
                <span style={{ fontSize: '10px', color: theme.colors.text3, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>followers</span>
              </div>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ ...DS.Type.Readable.Label, fontSize: '18px', fontWeight: 700, color: theme.colors.text1 }}>
                    <SlotCounter value={profileUser.following_count || 0} fontSize="18px" fontWeight={700} />
                </div>
                <span style={{ fontSize: '10px', color: theme.colors.text3, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5 }}>following</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ width: '100%', maxWidth: '240px' }}>
                {isMyProfile ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    style={{ 
                      width: '100%', 
                      background: theme.colors.text1, 
                      color: theme.colors.surface1, 
                      padding: '14px', 
                      borderRadius: theme.radius.md, 
                      fontWeight: 700, 
                      fontSize: '12px', 
                      cursor: 'pointer', 
                      border: 'none',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      transition: 'all 0.2s' 
                    }}
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={handleFollowToggle}
                      style={{ 
                        flex: 1,
                        padding: '14px', 
                        borderRadius: theme.radius.md, 
                        fontWeight: 700, 
                        fontSize: '12px', 
                        border: 'none', 
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        background: profileUser.is_following ? theme.colors.surface2 : theme.colors.text1,
                        color: profileUser.is_following ? theme.colors.text1 : theme.colors.surface1,
                        transition: 'all 0.2s'
                      }}
                    >
                      {profileUser.is_following ? 'Following' : 'Follow'}
                    </button>
                    <button 
                      onClick={handleMessage}
                      style={{ 
                        width: '48px',
                        height: '48px',
                        background: theme.colors.surface2, 
                        border: 'none', 
                        color: theme.colors.text1, 
                        borderRadius: theme.radius.md, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <ChatCircleText weight="bold" size={20} />
                    </button>
                  </div>
                )}
            </div>
        </div>

        {/* Post Grid - Seamless */}
        <div style={{ padding: '0 1px' }}>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px' }}>
             {posts.map((post, i) => (
               <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  key={post.id} 
                  onClick={() => navigate(`/post/${post.id}`)}
                  style={{ 
                    position: 'relative', 
                    aspectRatio: '1/1', 
                    cursor: 'pointer', 
                    overflow: 'hidden', 
                    backgroundColor: theme.colors.surface2 
                  }}
               >
                 <img 
                   src={post.image_url || 'https://picsum.photos/seed/placeholder/100/100'} 
                   alt="User Post" 
                   style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                 />
               </motion.div>
             ))}
           </div>
           {posts.length === 0 && (
             <div style={{ padding: '80px 0', textAlign: 'center', color: theme.colors.text3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <SquaresFour size={48} weight="thin" />
                <p style={{ ...DS.Type.Readable.Label, fontSize: '14px', opacity: 0.5 }}>No moments yet.</p>
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
                   background: theme.colors.surface1,
                   color: theme.colors.text1,
                   borderTopLeftRadius: theme.radius.xl,
                   borderTopRightRadius: theme.radius.xl,
                   padding: '40px 24px 48px 24px',
                   zIndex: 2001,
                   maxWidth: theme.layout.maxWidth,
                   margin: '0 auto',
                   boxShadow: '0 -10px 60px rgba(0,0,0,0.15)'
                 }}
               >
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                     <h3 style={{ ...DS.Type.Expressive.Display, fontSize: '20px', color: theme.colors.text1 }}>Edit Profile</h3>
                     <button 
                       onClick={() => setIsEditing(false)} 
                       style={{ 
                         background: theme.colors.surface3, 
                         border: 'none', 
                         color: theme.colors.text1,
                         width: '32px',
                         height: '32px',
                         borderRadius: '50%',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         cursor: 'pointer'
                       }}
                     >
                       <X size={20} weight="bold" />
                     </button>
                   </div>

                   {/* Avatar Upload */}
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
                       <div 
                         onClick={() => fileInputRef.current?.click()}
                         style={{ position: 'relative', cursor: 'pointer', borderRadius: '50%' }}
                       >
                           <Avatar 
                              src={previewAvatar || currentUser.avatar_url} 
                              alt="preview" 
                              size="xl" 
                              style={{ width: '110px', height: '110px' }} 
                           />
                           <div style={{ 
                               position: 'absolute', inset: 0, 
                               background: 'rgba(0,0,0,0.4)', 
                               borderRadius: '50%', 
                               display: 'flex', alignItems: 'center', justifyContent: 'center',
                               backdropFilter: 'blur(2px)',
                               opacity: 0,
                               transition: 'opacity 0.2s',
                               hover: { opacity: 1 }
                           }} className="avatar-overlay">
                               <Camera size={32} color="white" weight="fill" />
                           </div>
                           <style>{`
                               .avatar-overlay:hover { opacity: 1 !important; }
                           `}</style>
                       </div>
                       <input 
                           type="file" 
                           ref={fileInputRef} 
                           onChange={handleFileSelect} 
                           accept="image/*" 
                           style={{ display: 'none' }} 
                       />
                       <button 
                           onClick={() => fileInputRef.current?.click()}
                           style={{ 
                               background: 'none', border: 'none', 
                               color: theme.colors.accent, fontSize: '13px', fontWeight: 700, 
                               marginTop: '16px', cursor: 'pointer',
                               textTransform: 'uppercase',
                               letterSpacing: '1px'
                           }}
                       >
                           Change Photo
                       </button>
                   </div>

                   <div style={{ marginBottom: '24px' }}>
                       <label style={{ fontSize: '10px', color: theme.colors.text3, textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px', display: 'block', letterSpacing: '1px' }}>Full Name</label>
                       <input 
                         type="text" 
                         placeholder="Your name"
                         value={editName}
                         onChange={(e) => setEditName(e.target.value)}
                         style={{ 
                            ...commonStyles.inputReset, 
                            background: theme.colors.surface3, 
                            border: `1px solid ${theme.colors.border}`, 
                            borderRadius: theme.radius.md, 
                            padding: '16px',
                            fontSize: '15px',
                            color: theme.colors.text1
                          }}
                       />
                   </div>
                   
                   <div style={{ marginBottom: '40px' }}>
                       <label style={{ fontSize: '10px', color: theme.colors.text3, textTransform: 'uppercase', fontWeight: 800, marginBottom: '10px', display: 'block', letterSpacing: '1px' }}>Bio</label>
                       <textarea 
                         placeholder="Tell the world something..."
                         value={editBio}
                         onChange={(e) => setEditBio(e.target.value)}
                         style={{ 
                            ...commonStyles.inputReset, 
                            background: theme.colors.surface3, 
                            border: `1px solid ${theme.colors.border}`, 
                            borderRadius: theme.radius.md, 
                            padding: '16px', 
                            resize: 'none', 
                            height: '100px',
                            fontSize: '15px',
                            color: theme.colors.text1,
                            lineHeight: '1.5'
                          }}
                       />
                   </div>

                   <button 
                     onClick={handleSaveProfile}
                     style={{ 
                       width: '100%', 
                       background: theme.colors.accent, 
                       color: 'white', 
                       padding: '18px', 
                       borderRadius: theme.radius.full, 
                       border: 'none', 
                       fontWeight: 700, 
                       cursor: 'pointer', 
                       fontSize: '15px',
                       textTransform: 'uppercase',
                       letterSpacing: '1.5px',
                       boxShadow: `0 8px 20px ${theme.colors.accent}44`
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
