import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Notification } from '../../types';
import { DS } from '../../Theme';
import { Check, Heart, ChatCircle, UserPlus, Phone, ChatCircleText } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';

export const NotificationsPage: React.FC = () => {
  const { notifications, markAsRead } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={20} color={DS.Color.Status.Error} />;
      case 'comment': return <ChatCircle size={20} color={DS.Color.Accent.Surface} />;
      case 'follow': return <UserPlus size={20} color={DS.Color.Base.Content[1]} />;
      case 'call': return <Phone size={20} color={DS.Color.Accent.Surface} />;
      case 'message': return <ChatCircleText size={20} color={DS.Color.Accent.Surface} />;
      default: return null;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ ...DS.Type.Expressive.Display, marginBottom: '24px' }}>Notifications</h1>
      
      {notifications.length === 0 ? (
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
                    {notif.sender_profile?.username || 'Someone'}
                  </Link>
                  {' '}
                  {notif.type === 'like' && 'liked your post'}
                  {notif.type === 'comment' && 'commented on your post'}
                  {notif.type === 'follow' && 'followed you'}
                  {notif.type === 'message' && (
                    <>
                      sent you a message
                      <Link 
                        to={`/messages/${notif.sender_id}`} 
                        style={{ 
                          marginLeft: '12px', 
                          padding: '4px 12px', 
                          background: 'rgba(255,255,255,0.1)', 
                          color: DS.Color.Base.Content[1], 
                          borderRadius: '8px', 
                          textDecoration: 'none',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        REPLY
                      </Link>
                    </>
                  )}
                  {notif.type === 'call' && (
                    <>
                      is calling you
                      <Link 
                        to={`/call/${notif.reference_id}`} 
                        style={{ 
                          marginLeft: '12px', 
                          padding: '4px 12px', 
                          background: DS.Color.Accent.Surface, 
                          color: '#fff', 
                          borderRadius: '8px', 
                          textDecoration: 'none',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        JOIN
                      </Link>
                    </>
                  )}
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
