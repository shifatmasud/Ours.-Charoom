import { supabase, handleSupabaseError, isConnectionError, isDefaultUrl } from '../supabaseClient';
import { Notification } from '../../types';

export const getNotifications = async (userId: string): Promise<Notification[]> => {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
      const { data, error } = await Promise.race([
        supabase
          .from('notifications')
          .select('*, sender_profile:profiles!sender_id(*), receiver_profile:profiles!user_id(*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        timeout
      ]) as any;
      
      if (error) throw error;
      
      return (data || []).map((n: any) => ({
        ...n,
        sender_profile: Array.isArray(n.sender_profile) ? n.sender_profile[0] : n.sender_profile,
        receiver_profile: Array.isArray(n.receiver_profile) ? n.receiver_profile[0] : n.receiver_profile
      }));
    } catch (err: any) {
      if (err.message === 'timeout') {
          console.warn('Notifications fetch timed out');
          return [];
      }
      if (isConnectionError(err) && isDefaultUrl) {
          return [];
      }
      handleSupabaseError(err);
      return [];
    }
  };

export const markNotificationAsRead = async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      if (isConnectionError(err) && isDefaultUrl) return;
      handleSupabaseError(err);
    }
  };

export const sendNotification = async (userId: string, senderId: string, type: string, referenceId: string | null, mediaUrl?: string, senderUsername?: string): Promise<void> => {
    // Ensure referenceId is a valid UUID for the database
    // If it's a composite ID (like roomId), use the senderId or userId as a fallback UUID
    let dbReferenceId = referenceId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (referenceId && !uuidRegex.test(referenceId)) {
        dbReferenceId = senderId; // Fallback to a valid UUID
    }

    // 1. Instant Broadcast (Optimistic Delivery)
    const broadcastPayload = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        sender_id: senderId,
        type,
        reference_id: referenceId,
        media_url: mediaUrl,
        sender_username: senderUsername,
        created_at: new Date().toISOString(),
        is_read: false
    };

    const channel = supabase.channel('global_activities');
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            channel.send({
                type: 'broadcast',
                event: 'activity',
                payload: broadcastPayload
            }).then(() => {
                supabase.removeChannel(channel);
            });
        }
    });

    // 2. Direct DB Insert
    try {
        const { error } = await supabase.from('notifications').insert({
            user_id: userId,
            sender_id: senderId,
            type,
            reference_id: dbReferenceId,
            is_read: false
        });
        if (error) throw error;
    } catch (dbErr: any) {
        console.error("Direct notification insert failed:", dbErr.message, dbErr.details, dbErr.hint);
        throw dbErr; // Re-throw to identify the issue
    }
};
