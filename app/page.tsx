import { createClient } from "@/lib/supabase/server";
import { fetchGames } from "@/lib/games/queries";
import HomeClient from "@/components/HomeClient";
export default async function HomePage() {
  const supabase = await createClient();
  const games = await fetchGames(supabase);
  return <HomeClient previewGames={games.slice(0, 6)} />;
}
