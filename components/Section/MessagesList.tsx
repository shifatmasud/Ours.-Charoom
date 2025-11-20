
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/supabaseClient';
import { Profile } from '../../types';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { Avatar } from '../Core/Avatar';
import { theme, commonStyles } from '../../Theme';
import { motion } from 'framer-motion';

export const MessagesList: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await api.getAllProfiles();
        const currentUser = await api.getCurrentUser();
        setProfiles(data.filter(p => p.id !== currentUser.id));
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
    <motion.div 
      style={commonStyles.pageContainer}
      {...theme.motion.page}
    >
      <div style={{ width: '100%', maxWidth: theme.layout.maxWidth, paddingTop: '40px', paddingLeft: '24px', paddingRight: '24px', paddingBottom: '180px' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...theme.motion.gentle }}
            style={{ fontSize: '32px', color: theme.colors.text1, marginBottom: '4px' }}
          >
            Talks<span style={{ color: theme.colors.accent }}>.</span>
          </motion.h1>
        </div>

        {/* Glassy Search Pill */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ position: 'relative', marginBottom: '48px' }}
        >
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
        </motion.div>

        {/* Minimal List */}
        <motion.div 
          variants={listVariants}
          initial="hidden"
          animate="show"
          style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
        >
          {loading ? (
            <div style={{ color: theme.colors.text3, fontSize: '13px', marginTop: '20px' }}>loading...</div>
          ) : (
            filteredProfiles.map(profile => (
              <Link 
                key={profile.id} 
                to={`/messages/${profile.id}`} 
                style={{ textDecoration: 'none' }}
              >
                <motion.div 
                  variants={itemVariants}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '20px',
                    opacity: 0.8,
                    cursor: 'pointer'
                  }}
                  whileHover={{ opacity: 1, x: 5 }}
                >
                  <div style={{ position: 'relative' }}>
                    <Avatar src={profile.avatar_url} alt={profile.username} size="md" style={{ borderRadius: '12px' }} />
                    <div style={{ position: 'absolute', bottom: -2, right: -2, background: theme.colors.surface1, borderRadius: '50%', padding: '3px' }}>
                       <div style={{ width: '6px', height: '6px', background: theme.colors.accent, borderRadius: '50%' }}></div>
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontWeight: 500, fontSize: '16px', color: theme.colors.text1, margin: '0 0 4px 0' }}>{profile.username}</h4>
                    <p style={{ fontSize: '14px', color: theme.colors.text3, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {profile.bio || '...'}
                    </p>
                  </div>
                </motion.div>
              </Link>
            ))
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};