
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

    console.log("NotificationContext: Subscribing to global_activities for user", user.id);
    
    const channel = supabase.channel('global_activities')
      .on('broadcast', { event: 'activity' }, (payload) => {
        console.log("NotificationContext: Broadcast activity received", payload);
        const data = payload.payload;
        if (!data) {
            console.warn("NotificationContext: Received empty broadcast payload");
            return;
        }
        
        // Instant update for the toast/activity feed
        console.log("NotificationContext: Setting lastActivity", data.id);
        setLastActivity(data);
        
        setNotifications(prev => {
            // Avoid duplicates if we somehow get the same broadcast twice
            if (prev.some(n => n.id === data.id)) return prev;
            
            // Only increment unread count if it's for us and it's new
            if (data.user_id === user.id && data.sender_id !== user.id) {
                setUnreadCount(c => c + 1);
            }
            
            return [data, ...prev].slice(0, 50);
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
        console.log("NotificationContext: DB notification received", payload);
        
        // Fetch full notification with profiles to ensure we have sender_username etc.
        try {
          const { data: notif, error } = await supabase
            .from('notifications')
            .select('*, sender_profile:profiles!sender_id(*), receiver_profile:profiles!user_id(*)')
            .eq('id', payload.new.id)
            .single();

          if (error) throw error;
          if (notif) {
            const formattedNotif = {
              ...notif,
              sender_profile: Array.isArray(notif.sender_profile) ? notif.sender_profile[0] : notif.sender_profile,
              receiver_profile: Array.isArray(notif.receiver_profile) ? notif.receiver_profile[0] : notif.receiver_profile,
              // Ensure sender_username is available for the UI
              sender_username: notif.sender_profile?.username || notif.sender_username
            };
            
            setNotifications(prev => {
                // 1. Check if this exact notification already exists (by real ID)
                if (prev.some(n => n.id === formattedNotif.id)) return prev;
                
                // 2. Check for matching "temp" notification from optimistic broadcast to replace it
                const tempIndex = prev.findIndex(n => 
                    n.id.startsWith('temp-') && 
                    n.sender_id === formattedNotif.sender_id && 
                    n.type === formattedNotif.type && 
                    n.reference_id === formattedNotif.reference_id
                );

                if (tempIndex !== -1) {
                    const newNotifs = [...prev];
                    newNotifs[tempIndex] = formattedNotif;
                    return newNotifs;
                }
                
                // 3. If it's a completely new notification (not broadcasted yet)
                // Update lastActivity to trigger toast if it wasn't already triggered by broadcast
                setLastActivity(formattedNotif);

                // Only increment unread count if it's for us and it's new
                if (formattedNotif.user_id === user.id && formattedNotif.sender_id !== user.id) {
                    setUnreadCount(c => c + 1);
                }
                
                return [formattedNotif, ...prev].slice(0, 50);
            });
          }
        } catch (e) {
          console.error("NotificationContext: Failed to fetch notification details", e);
        }
      })
      .subscribe((status) => {
        console.log("NotificationContext: Subscription status:", status);
      });

    return () => {
      console.log("NotificationContext: Cleaning up subscription");
      supabase.removeChannel(channel);
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
