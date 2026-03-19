
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, supabase } from '../services/supabaseClient';
import { Notification } from '../types';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  lastActivity: any | null;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  lastActivity: null,
  refreshNotifications: async () => {},
  markAsRead: async () => {}
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastActivity, setLastActivity] = useState<any | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const notifs = await api.getNotifications(user.id);
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read && n.user_id === user.id).length);
    } catch (e) {
      console.error("NotificationContext: Failed to fetch notifications", e);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev => {
        const notif = prev.find(n => n.id === id);
        if (notif && !notif.is_read && notif.user_id === user?.id) {
            setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.map(n => n.id === id ? { ...n, is_read: true } : n);
      });
      await api.markNotificationAsRead(id);
    } catch (e) {
      console.error("NotificationContext: Failed to mark as read", e);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLastActivity(null);
      return;
    }

    fetchNotifications();

    console.log("NotificationContext: Subscribing to notifications for user", user.id);
    
    const channel = api.subscribeToNotifications(user.id, (formattedNotif) => {
        console.log("NotificationContext: Real-time notification received", formattedNotif);
        
        setNotifications(prev => {
            // 1. Check if this exact notification already exists (by real ID)
            if (prev.some(n => n.id === formattedNotif.id)) return prev;
            
            // 2. Update lastActivity to trigger toast
            setLastActivity(formattedNotif);

            // 3. Only increment unread count if it's for us and it's new
            if (formattedNotif.user_id === user.id && formattedNotif.sender_id !== user.id) {
                setUnreadCount(c => c + 1);
            }
            
            return [formattedNotif, ...prev].slice(0, 50);
        });
    });

    return () => {
      console.log("NotificationContext: Cleaning up subscription");
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      lastActivity, 
      refreshNotifications: fetchNotifications,
      markAsRead
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
