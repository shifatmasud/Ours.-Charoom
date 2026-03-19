
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
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
      const { data, error } = await supabase
        .from('notifications')
        .select('*, sender_profile:profiles!sender_id(*), receiver_profile:profiles!user_id(*)')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      const notifs = (data || []).map((n: any) => ({
        ...n,
        sender_profile: Array.isArray(n.sender_profile) ? n.sender_profile[0] : n.sender_profile,
        receiver_profile: Array.isArray(n.receiver_profile) ? n.receiver_profile[0] : n.receiver_profile
      }));
      
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (e) {
      console.error("NotificationContext: Failed to fetch notifications", e);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
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
        if (!data) return;
        
        // Skip own actions
        if (data.sender_id === user.id) return;

        setLastActivity(data);
        // Prepend to list if it's for us
        if (data.user_id === user.id) {
            setNotifications(prev => {
                if (prev.some(n => n.id === data.id)) return prev;
                return [data, ...prev].slice(0, 50);
            });
            setUnreadCount(prev => prev + 1);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
        console.log("NotificationContext: DB notification received", payload);
        
        // Skip own actions
        if (payload.new.sender_id === user.id) return;

        // Fetch full notification with profiles
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
              receiver_profile: Array.isArray(notif.receiver_profile) ? notif.receiver_profile[0] : notif.receiver_profile
            };
            
            setLastActivity(formattedNotif);
            if (formattedNotif.user_id === user.id) {
                setNotifications(prev => {
                    // Avoid duplicates if broadcast already added it
                    if (prev.some(n => n.id === formattedNotif.id)) return prev;
                    return [formattedNotif, ...prev].slice(0, 50);
                });
                setUnreadCount(prev => prev + 1);
            }
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
