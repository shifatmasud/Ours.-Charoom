
import React, { useEffect, useState } from 'react';
import { api, supabase } from '../../services/supabaseClient';
import { Notification } from '../../types';
import { Avatar } from '../Core/Avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { DS, theme, commonStyles } from '../../Theme';
import { Bell, Heart, ChatCircle, UserPlus, CaretLeft } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader } from '../Core/Loader';

export const Activity: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
     try {
         const data = await api.getNotifications();
         setNotifications(data);
     } catch (e) {
         console.error("Failed to load notifications", e);
     }
  };

  useEffect(() => {
    const load = async () => {
        await fetchNotifications();
        setLoading(false);
    };
    load();
    
    // Real-time Subscription
    let channel: any;
    if (user) {
        channel = supabase.channel('activity_feed_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                async () => {
                    await fetchNotifications(); // Refresh on new item
                }
            )
            .subscribe();
    }

    return () => {
        if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  const handleInteraction = async (n: Notification) => {
      // Optimistic update
      if (!n.is_read) {
          setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
          await api.markNotificationRead(n.id);
      }

      if (n.type === 'follow') {
           navigate(`/profile/${n.sender_profile?.id}`);
      } else {
           navigate(`/post/${n.reference_id}`);
      }
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'like': return <Heart weight="fill" color={DS.Color.Status.Error} size={12} />;
          case 'comment': return <ChatCircle weight="fill" color={DS.Color.Accent.Surface} size={12} />;
          case 'follow': return <UserPlus weight="fill" color="#22c55e" size={12} />;
          default: return <Bell weight="fill" color={DS.Color.Base.Content[3]} size={12} />;
      }
  };

  const getIconBg = (type: string) => {
      switch(type) {
          case 'like': return 'rgba(255, 51, 51, 0.1)';
          case 'comment': return 'rgba(255, 79, 31, 0.1)';
          case 'follow': return 'rgba(34, 197, 94, 0.1)';
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
                position: 'sticky', top: 0, zIndex: 50,
                background: `linear-gradient(to bottom, ${DS.Color.Base.Surface[1]} 80%, transparent 100%)`,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', gap: '16px'
            }}>
                <button 
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', color: theme.colors.text1, cursor: 'pointer', display: 'flex' }}
                >
                    <CaretLeft size={24} />
                </button>
                <h1 style={{ ...DS.Type.Expressive.Display, fontSize: '32px', color: theme.colors.text1, margin: 0 }}>
                    Activity<span style={{ color: theme.colors.accent }}>.</span>
                </h1>
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
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, index, icon, iconBg, onClick }) => {
    let timeLabel = '';
    try {
        timeLabel = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
            .replace('about ', '')
            .replace('less than a minute', 'just now');
    } catch (e) {}

    const isUnread = !notification.is_read;

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
                    <Avatar src={notification.sender_profile?.avatar_url || ''} alt="user" size="md" />
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
                     <span style={{ fontWeight: 600 }}>{notification.sender_profile?.username || 'Someone'}</span>
                     <span style={{ color: theme.colors.text2, marginLeft: '4px' }}>
                         {notification.type === 'like' && 'liked your moment.'}
                         {notification.type === 'comment' && 'commented on your moment.'}
                         {notification.type === 'follow' && 'started following you.'}
                     </span>
                 </p>
                 <span style={{ fontSize: '12px', color: theme.colors.text3, fontWeight: 500 }}>{timeLabel}</span>
             </div>

             {/* Right Side Interaction */}
             {notification.type === 'follow' ? (
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
             ) : (
                <div style={{
                    width: '40px', height: '40px',
                    borderRadius: DS.Radius.M,
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: DS.Color.Base.Surface[3],
                    border: `1px solid ${DS.Color.Base.Border}`
                }}>
                    <img 
                        src={notification.media_url || `https://picsum.photos/seed/${notification.reference_id}/100/100`} 
                        alt="ref" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                </div>
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
