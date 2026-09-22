import { createClient } from "@/lib/supabase/server";
import { fetchGames } from "@/lib/games/queries";
import HallOfFameClient from "@/components/HallOfFameClient";
export default async function HallOfFamePage() {
  const supabase = await createClient();
  const games = await fetchGames(supabase);
  return <HallOfFameClient games={games} />;
}
