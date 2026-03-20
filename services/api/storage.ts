import { supabase, handleSupabaseError } from '../supabaseClient';

export const uploadFile = async (file: File): Promise<string> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const { error } = await supabase.storage.from('images').upload(fileName, file);
        if (error) throw error;
        
        const { data } = supabase.storage.from('images').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (err: any) {
        handleSupabaseError(err);
    }
};
