"use server";
import { env } from '@/env';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
 env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY
);

export async function getGuestPhotoUrl(eventName: string, guestId: string): Promise<string | null> {
  console.log("🚀 ~ getGuestPhotoUrl ~ eventName:", eventName)
  const { data, error } = await supabase.storage
    .from('eventos')
    .list(eventName, { limit: 1 });
    
    console.log("🚀 ~ getGuestPhotoUrl ~ data:", data)
  console.log("🚀 ~ getGuestPhotoUrl ~ error:", error)
  if (error || !data || data.length === 0) return null;


  const file = data.find(f => f.name.includes(guestId));
  if (!file) return null;

  const { data: urlData } = supabase.storage
    .from('eventos')
    .getPublicUrl(`${eventName}/${file.name}`);

  return urlData.publicUrl;
}