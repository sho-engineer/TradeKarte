"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { THUMB_BUCKET } from "@/lib/db";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function deleteKarte(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || id === "" || !isSupabaseConfigured()) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: row } = await supabase
    .from("karte")
    .select("image_thumb_url")
    .eq("id", id)
    .single();

  await supabase.from("karte").delete().eq("id", id);
  if (row?.image_thumb_url) {
    await supabase.storage.from(THUMB_BUCKET).remove([row.image_thumb_url]);
  }

  revalidatePath("/app/history");
  redirect("/app/history");
}
