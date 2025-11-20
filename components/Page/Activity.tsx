import React, { useEffect, useState } from 'react';
import { api } from '../../services/supabaseClient';
import { Notification } from '../../types';
import { Avatar } from '../Core/Avatar';

export const Activity: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    api.getNotifications().then(setNotifications);
  }, []);

  return (
    <div className="min-h-screen bg-surface-1 text-content-1 w-full max-w-3xl mx-auto pt-6 px-4 pb-20 md:pb-8">
      <h2 className="text-2xl font-bold mb-8 font-display tracking-wide">Activity</h2>
      
      <div className="space-y-0 divide-y divide-surface-3 border-t border-surface-3">
        {notifications.map(n => (
          <div key={n.id} className="flex items-center justify-between py-4 hover:bg-surface-2/30 px-2 -mx-2 rounded-lg transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar src={n.sender_profile?.avatar_url || ''} alt="user" size="md" />
                {/* Notification indicator dot */}
                {!n.is_read && <div className="absolute top-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-surface-1"></div>}
              </div>
              <div className="text-sm leading-snug">
                <span className="font-semibold mr-1 hover:opacity-80">{n.sender_profile?.username}</span>
                <span className="text-content-2">
                  {n.type === 'like' && 'liked your photo.'}
                  {n.type === 'comment' && 'commented: Nice!'}
                  {n.type === 'follow' && 'started following you.'}
                </span>
                <div className="text-xs text-content-3 mt-1">2h</div>
              </div>
            </div>
            {n.type === 'follow' ? (
               <button className="bg-accent hover:bg-accent-hover text-white px-5 py-1.5 rounded-lg text-sm font-semibold transition-colors">Follow</button>
            ) : (
              <div className="w-11 h-11 bg-surface-3 rounded-md overflow-hidden border border-surface-3">
                <img src={`https://picsum.photos/seed/${n.reference_id}/100/100`} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        ))}
        {/* Mock data filler to show scrolling */}
        {Array.from({length: 5}).map((_, i) => (
           <div key={i} className="flex items-center justify-between py-4 border-t border-surface-3">
             <div className="flex items-center gap-4">
               <Avatar src={`https://picsum.photos/seed/notif${i}/100/100`} alt="user" size="md" />
               <div className="text-sm">
                  <span className="font-semibold mr-1">user_{i}</span>
                  <span className="text-content-2">started following you.</span>
                  <div className="text-xs text-content-3 mt-1">1d</div>
               </div>
             </div>
             <button className="bg-surface-3 hover:bg-surface-2 text-content-1 px-5 py-1.5 rounded-lg text-sm font-semibold transition-colors">Following</button>
           </div>
        ))}
      </div>
    </div>
  );
};