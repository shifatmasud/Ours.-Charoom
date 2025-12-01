
import React, { useEffect, useState } from 'react';
import { api } from '../../services/supabaseClient';
import { Notification } from '../../types';
import { Avatar } from '../Core/Avatar';
import { motion } from 'framer-motion';
import { DS, theme, commonStyles } from '../../Theme';
import { Bell, Heart, ChatCircle, UserPlus, CircleNotch } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

export const Activity: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
        try {
            const data = await api.getNotifications();
            setNotifications(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    load();
  }, []);

  const getIcon = (type: string) => {
      switch(type) {
          case 'like': return <Heart weight="fill" color={DS.Color.Status.Error} size={14} />;
          case 'comment': return <ChatCircle weight="fill" color={DS.Color.Accent.Surface} size={14} />;
          case 'follow': return <UserPlus weight="fill" color="#22c55e" size={14} />;
          default: return <Bell weight="fill" color={DS.Color.Base.Content[3]} size={14} />;
      }
  };

  if (loading) {
     return (
        <div style={{ ...commonStyles.flexCenter, height: '100vh', width: '100%', background: theme.colors.surface1 }}>
            <CircleNotch size={32} className="animate-spin" color={theme.colors.accent} />
        </div>
     );
  }

  return (
    <div style={commonStyles.pageContainer}>
        <div style={{ width: '100%', maxWidth: theme.layout.maxWidth, paddingBottom: '100px' }}>
            
            {/* Header */}
            <div style={{ 
                padding: '32px 24px 16px 24px', 
                position: 'sticky', top: 0, zIndex: 10,
                background: `linear-gradient(to bottom, ${DS.Color.Base.Surface[1]} 80%, transparent 100%)`,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
            }}>
                <h1 style={{ ...DS.Type.Expressive.Display, fontSize: '32px', color: theme.colors.text1 }}>
                    Activity<span style={{ color: theme.colors.accent }}>.</span>
                </h1>
            </div>

            {/* List */}
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifications.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ padding: '64px 0', textAlign: 'center', opacity: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
                    >
                        <Bell size={48} weight="thin" color={theme.colors.text3} />
                        <p style={{ ...DS.Type.Readable.Body, color: theme.colors.text3 }}>No recent activity.</p>
                    </motion.div>
                ) : (
                    notifications.map((n, i) => (
                        <NotificationItem key={n.id} notification={n} index={i} icon={getIcon(n.type)} />
                    ))
                )}
            </div>

        </div>
    </div>
  );
};

const NotificationItem = ({ notification, index, icon }: { notification: Notification, index: number, icon: React.ReactNode }) => {
    let timeLabel = '';
    try {
        timeLabel = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
            .replace('about ', '')
            .replace('less than a minute', 'just now');
    } catch (e) {}

    const isUnread = !notification.is_read;

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, ...DS.Motion.Spring.Gentle }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: DS.Radius.L,
                background: isUnread ? DS.Color.Base.Surface[2] : 'transparent',
                // subtle border for unread to pop slightly more, otherwise clean
                border: isUnread ? `1px solid ${DS.Color.Base.Border}` : '1px solid transparent',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
            }}
            whileHover={{ backgroundColor: DS.Color.Base.Surface[2] }}
        >
             {/* Unread Indicator */}
             {isUnread && (
                 <div style={{ 
                     position: 'absolute', top: '50%', left: '6px', transform: 'translateY(-50%)',
                     width: '4px', height: '4px', borderRadius: '50%', background: DS.Color.Accent.Surface 
                 }} />
             )}

             <div style={{ position: 'relative' }}>
                <Link to={`/profile/${notification.sender_profile?.id}`} onClick={(e) => e.stopPropagation()}>
                    <Avatar src={notification.sender_profile?.avatar_url || ''} alt="user" size="md" />
                </Link>
                <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    background: DS.Color.Base.Surface[1],
                    borderRadius: '50%', padding: '3px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: DS.Effect.Shadow.Soft,
                    border: `1px solid ${DS.Color.Base.Surface[1]}`
                }}>
                    {icon}
                </div>
             </div>

             <div style={{ flex: 1, marginLeft: '4px', overflow: 'hidden' }}>
                 <p style={{ fontSize: '14px', lineHeight: '1.4', color: theme.colors.text1, margin: 0 }}>
                     <span style={{ fontWeight: 600 }}>{notification.sender_profile?.username}</span>
                     <span style={{ color: theme.colors.text2, marginLeft: '4px' }}>
                         {notification.type === 'like' && 'liked your moment.'}
                         {notification.type === 'comment' && 'commented on your moment.'}
                         {notification.type === 'follow' && 'started following you.'}
                     </span>
                 </p>
                 <span style={{ fontSize: '11px', color: theme.colors.text3 }}>{timeLabel}</span>
             </div>

             {/* Right Side Interaction */}
             {notification.type === 'follow' ? (
                 <button style={{
                     padding: '6px 16px',
                     borderRadius: DS.Radius.Full,
                     background: DS.Color.Base.Surface[3],
                     color: theme.colors.text1,
                     fontSize: '12px',
                     fontWeight: 600,
                     border: `1px solid ${DS.Color.Base.Border}`,
                     cursor: 'pointer'
                 }}>
                     Follow
                 </button>
             ) : (
                 <Link to={`/post/${notification.reference_id}`} style={{ display: 'block' }}>
                    <div style={{
                        width: '44px', height: '44px',
                        borderRadius: DS.Radius.M,
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: DS.Color.Base.Surface[3],
                        border: `1px solid ${DS.Color.Base.Border}`
                    }}>
                        <img 
                            src={`https://picsum.photos/seed/${notification.reference_id}/100/100`} 
                            alt="ref" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                    </div>
                 </Link>
             )}
        </motion.div>
    );
};
