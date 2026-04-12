
import React, { useEffect, useState } from 'react';
import { api, supabase } from '../../services/supabaseClient';
import { Notification } from '../../types';
import { Avatar } from '../Core/Avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { DS, theme, commonStyles } from '../../Theme';
import { Bell, Heart, ChatCircle, UserPlus, CaretLeft, ArrowsClockwise } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Loader } from '../Core/Loader';

export const Activity: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, refreshNotifications, markAsRead } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(true);

  const handleRefresh = async () => {
      setRefreshing(true);
      await refreshNotifications();
      setTimeout(() => setRefreshing(false), 600);
  };

  useEffect(() => {
    if (notifications.length > 0 || !loading) {
        setLoading(false);
    }
    // If we've been loading for a while and still have no notifications, stop loading
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, [notifications, loading]);

  const handleInteraction = async (n: Notification) => {
      if (!n.is_read && n.user_id === user?.id) {
          await markAsRead(n.id);
      }

      if (n.type === 'follow') {
           navigate(`/profile/${n.sender_profile?.id}`);
      } else if (n.type === 'message') {
           navigate(`/messages/${n.sender_profile?.id}`);
      } else if (n.type === 'call') {
           // For calls, navigate to the room specified in reference_id
           navigate(`/call/${n.reference_id}`);
      } else {
           navigate(`/post/${n.reference_id}`);
      }
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'like': return <Heart weight="fill" color={DS.Color.Status.Error} size={12} />;
          case 'comment': return <ChatCircle weight="fill" color={DS.Color.Accent.Surface} size={12} />;
          case 'follow': return <UserPlus weight="fill" color="#22c55e" size={12} />;
          case 'message': return <ChatCircle weight="fill" color="#3b82f6" size={12} />;
          case 'post': return <Bell weight="fill" color="#8b5cf6" size={12} />;
          case 'call': return <Bell weight="fill" color="#f59e0b" size={12} />;
          default: return <Bell weight="fill" color={DS.Color.Base.Content[3]} size={12} />;
      }
  };

  const getIconBg = (type: string) => {
      switch(type) {
          case 'like': return 'rgba(255, 51, 51, 0.1)';
          case 'comment': return 'rgba(255, 79, 31, 0.1)';
          case 'follow': return 'rgba(34, 197, 94, 0.1)';
          case 'message': return 'rgba(59, 130, 246, 0.1)';
          case 'post': return 'rgba(139, 92, 246, 0.1)';
          case 'call': return 'rgba(245, 158, 11, 0.1)';
          default: return DS.Color.Base.Surface[2];
      }
  };

  if (loading) {
     return <Loader fullscreen label="ACTIVITY" />;
  }

  return (
    <div style={commonStyles.pageContainer}>
        <div style={{ width: '100%', maxWidth: theme.layout.maxWidth, minHeight: '100vh', paddingBottom: '100px' }}>
            
            {/* Header */}
            <div style={{ 
                padding: '24px 24px 16px 24px', 
                position: 'sticky', top: 0, zIndex: 100,
                background: `linear-gradient(to bottom, ${DS.Color.Base.Surface[1]} 80%, transparent 100%)`,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(-1);
                        }}
                        style={{ 
                            background: DS.Color.Base.Surface[2], 
                            border: `1px solid ${DS.Color.Base.Border}`, 
                            color: theme.colors.text1, 
                            cursor: 'pointer', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            zIndex: 101
                        }}
                    >
                        <CaretLeft size={24} />
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h1 style={{ ...DS.Type.Expressive.Display, fontSize: '32px', color: theme.colors.text1, margin: 0 }}>
                            Activity<span style={{ color: theme.colors.accent }}>.</span>
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ 
                                width: '6px', height: '6px', borderRadius: '50%', 
                                background: isLive ? '#22c55e' : '#94a3b8',
                                boxShadow: isLive ? '0 0 8px #22c55e' : 'none'
                            }} />
                            <span style={{ fontSize: '10px', fontWeight: 700, color: theme.colors.text3, letterSpacing: '0.05em' }}>
                                {isLive ? 'LIVE' : 'CONNECTING...'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={handleRefresh}
                    disabled={refreshing}
                    style={{ 
                        background: DS.Color.Base.Surface[2], 
                        border: `1px solid ${DS.Color.Base.Border}`, 
                        color: theme.colors.text1, 
                        cursor: 'pointer', 
                        width: '40px', height: '40px',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <motion.div
                        animate={{ rotate: refreshing ? 360 : 0 }}
                        transition={{ duration: 0.5, repeat: refreshing ? Infinity : 0, ease: "linear" }}
                    >
                        <ArrowsClockwise size={20} />
                    </motion.div>
                </button>
            </div>

            {/* List */}
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '0' }}>
                <AnimatePresence>
                {notifications.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        style={{ padding: '64px 0', textAlign: 'center', opacity: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
                    >
                        <div style={{ 
                            width: '64px', height: '64px', borderRadius: '50%', 
                            background: DS.Color.Base.Surface[2], display: 'flex', alignItems: 'center', justifyContent: 'center' 
                        }}>
                            <Bell size={24} weight="duotone" color={theme.colors.text3} />
                        </div>
                        <p style={{ ...DS.Type.Readable.Body, color: theme.colors.text3 }}>No recent activity.</p>
                    </motion.div>
                ) : (
                    notifications.map((n, i) => (
                        <NotificationItem 
                            key={n.id} 
                            notification={n} 
                            index={i} 
                            icon={getIcon(n.type)} 
                            iconBg={getIconBg(n.type)}
                            onClick={() => handleInteraction(n)}
                            currentUser={user}
                        />
                    ))
                )}
                </AnimatePresence>
            </div>
            
            <div style={{ height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.3 }}>
                 <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: DS.Color.Base.Content[3] }}></div>
            </div>

        </div>
    </div>
  );
};

interface NotificationItemProps {
    notification: Notification;
    index: number;
    icon: React.ReactNode;
    iconBg: string;
    onClick: () => void;
    currentUser: any;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, index, icon, iconBg, onClick, currentUser }) => {
    let timeLabel = '';
    try {
        timeLabel = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
            .replace('about ', '')
            .replace('less than a minute', 'just now');
    } catch (e) {}

    const isUnread = !notification.is_read && notification.user_id === currentUser?.id;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, ...DS.Motion.Spring.Gentle }}
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                borderRadius: DS.Radius.L,
                background: isUnread ? DS.Color.Base.Surface[2] : 'transparent',
                position: 'relative',
                cursor: 'pointer',
                marginBottom: '4px',
            }}
            whileHover={{ backgroundColor: DS.Color.Base.Surface[2], scale: 0.99 }}
            whileTap={{ scale: 0.98 }}
        >
             {/* Avatar with Badge */}
             <div style={{ position: 'relative', flexShrink: 0 }}>
                <Link to={`/profile/${notification.sender_profile?.id}`} onClick={(e) => e.stopPropagation()}>
                    <Avatar src={notification.sender_profile?.avatar_url || ''} alt={notification.sender_profile?.username || 'user'} size="md" />
                </Link>
                <div style={{
                    position: 'absolute', bottom: -4, right: -4,
                    background: DS.Color.Base.Surface[1], // Border color match
                    borderRadius: '50%', padding: '2px', // Pseudo border
                }}>
                    <div style={{
                        width: '20px', height: '20px',
                        borderRadius: '50%',
                        background: iconBg, // Specific bg for type
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(4px)',
                        border: `1px solid ${DS.Color.Base.Surface[3]}`
                    }}>
                        {icon}
                    </div>
                </div>
             </div>

             {/* Text Content */}
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                 <p style={{ fontSize: '14px', lineHeight: '1.4', color: theme.colors.text1, margin: 0 }}>
                     <span style={{ fontWeight: 600 }}>{notification.sender_profile?.username}</span>
                     <span style={{ color: theme.colors.text2, marginLeft: '4px' }}>
                         {notification.type === 'like' && (
                             <>liked <span style={{ fontWeight: 600 }}>{notification.user_id === currentUser?.id ? 'your' : `${notification.receiver_profile?.username}'s`}</span> moment.</>
                         )}
                         {notification.type === 'comment' && (
                             <>commented on <span style={{ fontWeight: 600 }}>{notification.user_id === currentUser?.id ? 'your' : `${notification.receiver_profile?.username}'s`}</span> moment.</>
                         )}
                         {notification.type === 'follow' && (
                             <>started following <span style={{ fontWeight: 600 }}>{notification.user_id === currentUser?.id ? 'you' : notification.receiver_profile?.username}</span>.</>
                         )}
                         {notification.type === 'message' && (
                             <>sent a message to <span style={{ fontWeight: 600 }}>{notification.user_id === currentUser?.id ? 'you' : (notification.receiver_profile?.username || 'codex')}</span>.</>
                         )}
                         {notification.type === 'post' && (
                             <>shared a new moment.</>
                         )}
                         {notification.type === 'call' && (
                             <>started a call with <span style={{ fontWeight: 600 }}>{notification.user_id === currentUser?.id ? 'you' : (notification.receiver_profile?.username || 'codex')}</span>.</>
                         )}
                     </span>
                 </p>
                 <span style={{ fontSize: '12px', color: theme.colors.text3, fontWeight: 500 }}>{timeLabel}</span>
             </div>

             {/* Right Side Interaction */}
             {notification.media_url ? (
                <div style={{
                    width: '44px', height: '44px',
                    borderRadius: DS.Radius.S,
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: DS.Color.Base.Surface[3],
                    border: `1px solid ${DS.Color.Base.Border}`
                }}>
                    <img 
                        src={notification.media_url} 
                        alt="context" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                </div>
             ) : (
                (notification.type === 'follow' || notification.type === 'message' || notification.type === 'call') && (
                    <button style={{
                        padding: '6px 14px',
                        borderRadius: DS.Radius.Full,
                        background: DS.Color.Base.Surface[3],
                        color: theme.colors.text1,
                        fontSize: '12px',
                        fontWeight: 600,
                        border: `1px solid ${DS.Color.Base.Border}`,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                    }}>
                        View
                    </button>
                )
             )}
             
             {/* Unread Dot */}
             {isUnread && (
                 <div style={{ 
                     position: 'absolute', top: '16px', right: '16px',
                     width: '6px', height: '6px', borderRadius: '50%', background: DS.Color.Accent.Surface 
                 }} />
             )}
        </motion.div>
    );
};
