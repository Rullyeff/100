import { checkedAt } from "@/seratus/lib/checked-at";
import { BookOpen, Dices, Vote, Hand } from "lucide-react";
import { currentPlayer, type GameState } from "@/seratus/game/view";
import { cn } from "@/lib/utils";
import { PlayerAvatar, moodOf } from "./PlayerAvatar";

const READ_KINDS = new Set(["aspirasi", "cekfakta", "misi", "dilema", "refleksi", "duel", "kejutan"]);

/** Presentation-only: who is playing now and what they're doing (reading, voting, rolling). */
export function activityOf(s: GameState, actor: number | "host" | null) {
  const cur = currentPlayer(s);
  const who = typeof actor === "number" ? checkedAt(s.players, actor) : cur;
  const kind = s.pending?.kind;
  if (s.stage === "roll") return { who, Icon: Dices, text: "bersiap melempar dadu", reading: false };
  if (s.stage === "end") return { who, Icon: Hand, text: "melihat hasil giliran", reading: false };
  if (kind && READ_KINDS.has(kind)) return { who, Icon: BookOpen, text: "sedang membaca pertanyaan", reading: true };
  if (kind === "forum" || kind === "putusan") return { who, Icon: Vote, text: "memberi suara rahasia", reading: false };
  return { who, Icon: Hand, text: "sedang memutuskan", reading: false };
}

export function TurnBanner({ state, actor }: { state: GameState; actor: number | "host" | null }) {
  if (state.stage === "over") return null;
  const { who, Icon, text, reading } = activityOf(state, actor);
  return (
    <div key={`${who.id}-${state.turnCount}`} className="turn-banner flex items-center gap-2 rounded-full border border-gold bg-gold/10 py-0.5 pl-0.5 pr-3" role="status" aria-live="polite">
      <span className="turn-banner-avatar rounded-full">
        <PlayerAvatar area={who.area} avatar={who.avatar} mood={moodOf(state, who.id)} size={28} />
      </span>
      <span className="text-xs font-bold">Giliran {who.name}</span>
      <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", reading && "font-semibold text-primary")}>
        <Icon className={cn("size-3.5", reading && "turn-reading-icon")} />
        {who.isBot ? text : text.replace("sedang ", "")}
        <span className="turn-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
      </span>
    </div>
  );
}
