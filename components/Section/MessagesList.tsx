
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/supabaseClient';
import { Profile, Message } from '../../types';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Avatar } from '../Core/Avatar';
import { theme, commonStyles } from '../../Theme';
import { motion } from 'framer-motion';
import { BrandedProgressBar } from '../Core/BrandedProgressBar';

interface ProfileWithMeta extends Profile {
  lastMessage?: Message | null;
}

export const MessagesList: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileWithMeta[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const currentUser = await api.getCurrentUser();
        const data = await api.getAllProfiles();
        // Filter out current user
        const others = data.filter(p => p.id !== currentUser.id);

        // Fetch last message for each user to sort and display preview
        const profilesWithMessages = await Promise.all(
          others.map(async (profile) => {
            const lastMsg = await api.getLastMessage(profile.id);
            return { ...profile, lastMessage: lastMsg };
          })
        );

        // Sort: Latest active conversations first, then others
        profilesWithMessages.sort((a, b) => {
            const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
            const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
            return timeB - timeA;
        });

        setProfiles(profilesWithMessages);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);

  const filteredProfiles = profiles.filter(p => 
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  const listVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10, filter: "blur(5px)" },
    show: { opacity: 1, x: 0, filter: "blur(0px)", transition: theme.motion.gentle }
  };

  return (
    <div style={commonStyles.pageContainer}>
      <div style={{ width: '100%', maxWidth: theme.layout.maxWidth, paddingTop: '40px', paddingLeft: '24px', paddingRight: '24px', paddingBottom: '180px' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', color: theme.colors.text1, marginBottom: '4px' }}>
            Talks<span style={{ color: theme.colors.accent }}>.</span>
          </h1>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '32px' }}>
          <div style={{
              position: 'relative',
              background: theme.colors.inputBg,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: theme.radius.full,
              padding: '2px 20px',
              display: 'flex',
              alignItems: 'center',
              border: `1px solid ${theme.colors.border}`,
              boxShadow: theme.shadow.soft
          }}>
              <MagnifyingGlass size={20} color={theme.colors.text3} style={{ marginRight: '12px' }} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  padding: '12px 0',
                  color: theme.colors.text1,
                  fontSize: '16px',
                  border: 'none',
                  outline: 'none',
                  fontFamily: theme.fonts.body,
                }}
              />
          </div>
        </div>

        {/* Messages List */}
        <motion.div 
          variants={listVariants}
          initial="hidden"
          animate="show"
          style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
        >
          {loading ? (
            <div style={{ padding: '24px 0' }}>
               <BrandedProgressBar label="SYNCING" subLabel="RETRIEVING DATA STREAMS" />
            </div>
          ) : (
            filteredProfiles.map(profile => {
              const hasMessage = !!profile.lastMessage;
              const isMe = profile.lastMessage?.sender_id && profile.lastMessage.sender_id !== profile.id;
              
              return (
                <Link 
                  key={profile.id} 
                  to={`/messages/${profile.id}`} 
                  style={{ textDecoration: 'none' }}
                >
                  <motion.div 
                    variants={itemVariants}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '20px',
                      opacity: hasMessage ? 1 : 0.6,
                      cursor: 'pointer'
                    }}
                    whileHover={{ opacity: 1, x: 5 }}
                  >
                    <div style={{ position: 'relative' }}>
                      <Avatar src={profile.avatar_url} alt={profile.username} size="md" style={{ borderRadius: '12px' }} />
                      {hasMessage && (
                        <div style={{ position: 'absolute', bottom: -2, right: -2, background: theme.colors.surface1, borderRadius: '50%', padding: '3px' }}>
                           <div style={{ width: '6px', height: '6px', background: theme.colors.accent, borderRadius: '50%' }}></div>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <h4 style={{ fontWeight: 500, fontSize: '16px', color: theme.colors.text1, margin: '0 0 4px 0' }}>{profile.username}</h4>
                          {hasMessage && (
                              <span style={{ fontSize: '11px', color: theme.colors.text3 }}>
                                  {new Date(profile.lastMessage!.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                          )}
                      </div>
                      
                      <p style={{ 
                        fontSize: '14px', 
                        color: hasMessage ? theme.colors.text2 : theme.colors.text3, 
                        margin: 0, 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        fontWeight: hasMessage && !isMe ? 500 : 400 
                      }}>
                        {hasMessage ? (
                            <>
                                {isMe && <span style={{ color: theme.colors.text3 }}>You: </span>}
                                {profile.lastMessage?.type === 'image' ? '📷 Image' : profile.lastMessage?.type === 'audio' ? '🎤 Voice Message' : profile.lastMessage?.content}
                            </>
                        ) : (
                            <span style={{ fontStyle: 'italic', fontSize: '13px' }}>Start a conversation</span>
                        )}
                      </p>
                    </div>
                  </motion.div>
                </Link>
              );
            })
          )}
          
          {!loading && filteredProfiles.length === 0 && (
             <div style={{ color: theme.colors.text3, textAlign: 'center', marginTop: '40px' }}>No users found.</div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
