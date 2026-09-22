import { createClient } from "@/lib/supabase/server";
import { fetchGames } from "@/lib/games/queries";
import LibraryClient from "@/components/LibraryClient";
export default async function LibraryPage() {
  const supabase = await createClient();
  const games = await fetchGames(supabase);
  return <LibraryClient games={games} />;
}