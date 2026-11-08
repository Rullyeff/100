import { Bot, Coins, User } from "lucide-react";
import { AREAS, currentPlayer, handCount, type GameState } from "@/seratus/game/view";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import { PlayerAvatar, moodOf } from "./PlayerAvatar";
import { areaVar } from "./theme";

/**
 * Compact player chips laid over the board, each placed toward its own area's arm:
 * Pendidikan at the top, Lingkungan top-right, Ekonomi bottom-right, Layanan Publik bottom-left, Inklusivitas top-left.
 * Positions sit in the board art's empty margins and are presentation-only.
 */
const SLOT_CLASS = ["board-player-top", "board-player-tr", "board-player-br", "board-player-bl", "board-player-tl"];

export function BoardPlayers({ state }: { state: GameState }) {
  const cur = currentPlayer(state);
  const hands = state.players.map((p) => handCount(state, p.id));
  // Standard competition ranking: ties share a place.
  const ranked = new Set(hands).size > 1;
  const rankOf = (i: number) => 1 + hands.filter((h) => h > hands[i]).length;
  return (
    <div className="board-players" aria-label="Pemain di papan">
      {state.players.map((p, i) => {
        const active = p.id === cur.id && state.stage !== "over";
        const reading = active && state.stage === "pending" && !!state.pending && "cardId" in state.pending && state.pending.kind !== "forum" && state.pending.kind !== "putusan";
        const status = p.phase === "out" ? "Gugur" : p.phase === "done" ? "Selesai" : reading ? (p.isBot ? "Membaca…" : "Menjawab…") : active ? "Giliran" : "Menunggu";
        const hand = hands[i];
        const rank = rankOf(i);
        const mood = moodOf(state, p.id);
        return (
          <div
            key={p.id}
            data-vote-player={p.id}
            className={cn("board-player", SLOT_CLASS[p.area], active && "board-player-active", mood === "happy" && "board-player-happy", (p.phase === "out" || p.phase === "done") && "board-player-idle")}
            style={{ "--area": areaVar(p.area) } as CSSProperties}
            title={`${p.name} · ${AREAS[p.area].name} · ${hand} suara di tangan · ${status}`}
          >
            <PlayerAvatar area={p.area} avatar={p.avatar} playerId={p.id} mood={mood} size={40} dim={p.phase === "out"} className="board-player-avatar" />
            {ranked && <span className={cn("board-player-rank", rank <= 3 && `board-player-rank-${rank}`)} aria-label={`Peringkat ${rank}`}>#{rank}</span>}
            <div className="board-player-body">
              <div className="board-player-name">
                <span>{p.name}</span>
                {p.isBot ? <Bot aria-label="Bot" /> : <User aria-label="Manusia" />}
              </div>
              <div className="board-player-meta">
                <span className="board-player-votes"><Coins aria-hidden /> {hand}</span>
                <span className="board-player-status">{status}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
