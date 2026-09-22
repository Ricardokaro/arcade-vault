import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchGame } from "@/lib/games/queries";
import GamePlayer from "@/components/GamePlayer";
export default async function GamePlayerPage({
  params,
}: PageProps<"/jugar/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const game = await fetchGame(supabase, id);
  if (!game) notFound();
  return <GamePlayer game={game} />;
}
