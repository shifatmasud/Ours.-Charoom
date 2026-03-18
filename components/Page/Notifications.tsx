import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/supabaseClient';
import { Notification } from '../../types';
import { DS } from '../../Theme';
import { Check, Heart, ChatCircle, UserPlus, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notifId: string) => {
    try {
      await api.markNotificationRead(notifId);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error("Failed to mark notification read", e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={20} color={DS.Color.Status.Error} />;
      case 'comment': return <ChatCircle size={20} color={DS.Color.Accent.Surface} />;
      case 'follow': return <UserPlus size={20} color={DS.Color.Base.Content[1]} />;
      default: return null;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ ...DS.Type.Expressive.Display, fontSize: '32px', marginBottom: '24px' }}>Notifications</h1>
      
      {loading ? (
        <div style={{ color: DS.Color.Base.Content[3] }}>Loading...</div>
      ) : notifications.length === 0 ? (
        <div style={{ color: DS.Color.Base.Content[3] }}>No new notifications.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <AnimatePresence>
            {notifications.map(notif => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  padding: '16px',
                  borderRadius: DS.Radius.M,
                  backgroundColor: notif.is_read ? 'transparent' : DS.Color.Base.Surface[2],
                  border: `1px solid ${notif.is_read ? DS.Color.Base.Surface[2] : 'transparent'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {getIcon(notif.type)}
                <div style={{ flex: 1, fontSize: '14px', color: DS.Color.Base.Content[1] }}>
                  <Link to={`/profile/${notif.sender_id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
                    {notif.sender_profile?.username}
                  </Link>
                  {' '}
                  {notif.type === 'like' && 'liked your post'}
                  {notif.type === 'comment' && 'commented on your post'}
                  {notif.type === 'follow' && 'followed you'}
                </div>
                {!notif.is_read && (
                  <button 
                    onClick={() => markAsRead(notif.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: DS.Color.Base.Content[3] }}
                  >
                    <Check size={16} />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
