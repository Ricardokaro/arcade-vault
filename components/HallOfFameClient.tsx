"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Game, ScoreRow } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { fetchTopScores, fetchUserBestScore } from "@/lib/games/queries";
import { useUser } from "@/components/UserProvider";
export default function HallOfFameClient({ games }: { games: Game[] }) {
  const { user } = useUser();
  const [tab, setTab] = useState(games[0].id);
  const userKey = user?.name ?? null;
  const [result, setResult] = useState<{
    tab: string;
    userKey: string | null;
    rows: ScoreRow[];
    userBest: number | null;
  } | null>(null);
  const game = games.find((g) => g.id === tab)!;
  const loading = !result || result.tab !== tab || result.userKey !== userKey;
  const rows = loading ? [] : result.rows;
  const userBest = loading ? null : result.userBest;
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    Promise.all([
      fetchTopScores(supabase, tab, 12),
      user
        ? fetchUserBestScore(supabase, tab, user.name)
        : Promise.resolve(null),
    ]).then(([topScores, best]) => {
      if (cancelled) return;
      setResult({ tab, userKey, rows: topScores, userBest: best });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, userKey, user]);
  const youRow = user ? rows.find((r) => r.name === user.name) : undefined;
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>
      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--ink-faint)",
          }}
        >
          CARGANDO…
        </div>
      ) : rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--ink-faint)",
          }}
        >
          <div
            className="pixel neon-yellow"
            style={{ fontSize: 14, marginBottom: 12 }}
          >
            SÉ EL PRIMERO EN PUNTUAR
          </div>
          <div>Todavía nadie jugó {game.title}.</div>
        </div>
      ) : (
        <>
          <div className="podium">
            {rows[1] && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].name}</div>
                <div className="score">
                  {rows[1].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[1].date}</div>
              </div>
            )}
            {rows[0] && (
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
                <div
                  className="rank-num"
                  style={{ fontSize: 36, marginTop: 4 }}
                >
                  01
                </div>
                <div className="name">{rows[0].name}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {rows[0].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[0].date}</div>
              </div>
            )}
            {rows[2] && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].name}</div>
                <div className="score">
                  {rows[2].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[2].date}</div>
              </div>
            )}
          </div>
          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.name + i}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {user && userBest !== null && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    {youRow ? `#${String(youRow.rank).padStart(2, "0")}` : "—"}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {user.name}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {userBest.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">{youRow ? youRow.date : "—"}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/games" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
