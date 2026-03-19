import { supabase, handleSupabaseError, IS_MOCK_MODE, MOCK_USER } from '../supabaseClient';
import { CurrentUser } from '../../types';
import { getUserProfile } from './profiles';

export const signUpWithEmail = async (email: string, pass: string, fullName: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
  } catch (err: any) {
    handleSupabaseError(err);
  }
};

export const signInWithPassword = async (email: string, pass: string): Promise<CurrentUser> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    
    // Fetch or construct profile - pass the user object to avoid redundant network calls
    const profile = await getUserProfile(data.user.id, data.user).catch(() => null);
    
    if (!profile) {
        // Fallback using auth metadata if profile row is missing
        return {
            id: data.user.id,
            username: data.user.user_metadata?.full_name?.replace(/\s+/g, '_').toLowerCase() || email.split('@')[0],
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.id}`,
            full_name: data.user.user_metadata?.full_name || email.split('@')[0]
        };
    }
    return profile;
  } catch (err: any) {
    handleSupabaseError(err);
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/#/login' });
  if (error) throw error;
};

export const updatePassword = async (newPassword: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const signOut = async (): Promise<void> => {
  localStorage.removeItem('sb_user_profile');
  await supabase.auth.signOut();
  window.location.href = '/';
};

export const getCurrentUser = async (): Promise<CurrentUser> => {
  try {
      // Use getSession first as it's faster (local storage)
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData?.session?.user;
      
      if (!user) {
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError || !authData?.user) {
              // If no user is logged in, and we are explicitly in mock mode, show mock user
              if (IS_MOCK_MODE) return MOCK_USER;
              // If on default URL and unreachable, show mock user
              // ... (need to import isDefaultUrl and other helpers)
              throw authError || new Error('No user logged in');
          }
          user = authData.user;
      }
      
      // Fetch profile
      const profile = await getUserProfile(user.id, user);
      return profile;
  } catch (err: any) {
      if (IS_MOCK_MODE) {
          console.warn('Auth: Default project unreachable or mock mode, using mock user');
          return MOCK_USER;
      }
      throw err;
  }
};

export const updateCurrentUser = async (updates: Partial<CurrentUser>): Promise<CurrentUser> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user');
    
    // Whitelist allowed fields to prevent errors with virtual properties
    const safeUpdates: any = {};
    if (updates.full_name !== undefined) safeUpdates.full_name = updates.full_name;
    if (updates.bio !== undefined) safeUpdates.bio = updates.bio;
    if (updates.avatar_url !== undefined) safeUpdates.avatar_url = updates.avatar_url;

    // Use maybeSingle to avoid error if row doesn't exist
    const { data, error } = await supabase.from('profiles').update(safeUpdates).eq('id', user.id).select().maybeSingle();
    
    if (error) throw error;
    
    if (!data) {
        // If profile row missing, create it now
        const username = user.user_metadata?.full_name?.replace(/\s+/g, '_').toLowerCase() || user.email?.split('@')[0] || `user_${user.id.slice(0,8)}`;
        const { error: insertError } = await supabase.from('profiles').insert({
            id: user.id,
            username: username,
            avatar_url: safeUpdates.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
            full_name: safeUpdates.full_name || user.user_metadata?.full_name || '',
            bio: safeUpdates.bio || '',
            updated_at: new Date().toISOString()
        });
        if (insertError) throw insertError;
    }
    
    // Re-fetch to get correct counts and virtuals
    return await getUserProfile(user.id);
  };
