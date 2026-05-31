"use server";
import { env } from '@/env';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
 env.SUPABASE_URL,
    env.SUPABASE_PUBLISHABLE_KEY
);

export async function getGuestPhotoUrl(eventName: string, guestName: string): Promise<string | null> {
  const normalizedGuest = guestName.trim().toUpperCase().replace(/\s+/g, '_');

  const { data, error } = await supabase.storage
    .from('eventos')
    .list(eventName, { limit: 100 });
    console.log("🚀 ~ getGuestPhotoUrl ~ error:", error)
  console.log("🚀 ~ getGuestPhotoUrl ~ data:", data)
  if (error || !data || data.length === 0) return null;

  const file = data.find(f => f.name.includes(normalizedGuest));
  if (!file) return null;

  const { data: urlData } = supabase.storage
    .from('eventos')
    .getPublicUrl(`${eventName}/${file.name}`);

  return urlData.publicUrl;
}