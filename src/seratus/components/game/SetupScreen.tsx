import { useState } from "react";
import { Bot, Play, RotateCw, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AREAS, type GameState, type PlayerConfig } from "@/seratus/game/view";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AvatarGrid, PlayerAvatar } from "./PlayerAvatar";
import { PlayHeading } from "./PlayMenu";

const BOT_NAMES = ["Bot Arunika", "Bot Bayu", "Bot Citra", "Bot Damar", "Bot Embun"];

const PRESETS = [
  { humans: 0, label: "Simulasi 5 Bot", icon: Bot },
  { humans: 1, label: "1 Manusia + 4 Bot", icon: User },
  { humans: 2, label: "2 Manusia + 3 Bot", icon: Users },
  { humans: 5, label: "5 Manusia bergantian", icon: Users },
] as const;

export function SetupScreen({
  onStart,
  saved,
  onResume,
  error,
}: {
  onStart: (c: PlayerConfig[]) => void;
  saved: GameState | null;
  onResume: () => void;
  error?: string | null;
  testDice?: boolean;
  setTestDice?: (v: boolean) => void;
}) {
  const [slots, setSlots] = useState<PlayerConfig[]>(() =>
    AREAS.map((_, i) => (i === 0 ? { name: "Kamu", isBot: false, avatar: i } : { name: BOT_NAMES[i], isBot: true, avatar: i })),
  );

  const preset = (humans: number) =>
    setSlots((cur) => AREAS.map((_, i) => ({ ...(i < humans ? { name: `Pemain ${i + 1}`, isBot: false } : { name: BOT_NAMES[i], isBot: true }), avatar: cur[i]?.avatar ?? i })));

  const update = (i: number, patch: Partial<PlayerConfig>) =>
    setSlots((s) => s.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const humans = slots.filter((s) => !s.isBot).length;

  return (
    <>
      <PlayHeading icon={Bot} title="Latihan vs Bot" subtitle="Lima kursi, lima area. Isi tiap kursi dengan pemain di perangkat ini atau Bot otomatis." />
      {error && <p role="alert" className="play-alert">{error}</p>}
      <div className="play-body play-split play-split-seats">
        <div className="play-col">
          {saved && saved.stage !== "over" && (
            <div className="play-card play-saved">
              <div className="min-w-0">
                <div className="font-semibold">Permainan tersimpan</div>
                <div className="truncate text-xs text-muted-foreground">
                  Ronde {saved.turnCount} · {saved.players.map((p) => p.name).join(", ")}
                </div>
              </div>
              <Button variant="gold" className="shrink-0" onClick={onResume}>
                <RotateCw /> Lanjutkan
              </Button>
            </div>
          )}

          <div>
            <p className="play-label">FORMASI CEPAT</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <Button key={p.humans} variant="outline" className="play-preset h-auto min-h-11 justify-start whitespace-normal text-left text-xs" aria-pressed={humans === p.humans} onClick={() => preset(p.humans)}>
                  <p.icon /> {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="play-actions">
            <Button size="lg" className="play-cta h-12 w-full text-base" onClick={() => onStart(slots)}>
              <Play /> Mulai Permainan
            </Button>
            <p className="play-note">Bergantian di satu perangkat. Dadu dan jawaban diproses oleh sistem; permainan tersimpan otomatis.</p>
          </div>
        </div>

        <div className="play-seats">
          {slots.map((s, i) => (
            <div key={i} className="play-seat play-slot">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" aria-label={`Pilih avatar ${AREAS[i].name}`} className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <PlayerAvatar area={i} avatar={s.avatar ?? i} size={42} />
                    <span className="absolute -bottom-1 -right-1 rounded-full border bg-card px-1 text-[9px] font-bold shadow group-hover:bg-gold group-hover:text-gold-foreground">Ganti</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="dark w-[22rem]" align="start">
                  <div className="mb-2 text-sm font-semibold">Pilih avatar</div>
                  <AvatarGrid area={i} value={s.avatar ?? i} onPick={(k) => update(i, { avatar: k })} />
                </PopoverContent>
              </Popover>
              <div className="play-slot-area">
                <div className="text-sm font-semibold">{AREAS[i].name}</div>
                <div className="text-[10px] text-muted-foreground">START {i + 1}</div>
              </div>
              <Input
                aria-label={`Nama pemain ${AREAS[i].name}`}
                value={s.name}
                maxLength={18}
                onChange={(e) => update(i, { name: e.target.value })}
                className="play-input play-slot-name h-9"
              />
              <div className="play-toggle">
                <button
                  type="button"
                  className={cn(!s.isBot && "play-toggle-on")}
                  onClick={() => update(i, { isBot: false, name: s.isBot ? `Pemain ${i + 1}` : s.name })}
                  aria-pressed={!s.isBot}
                  aria-label="Manusia"
                  title="Manusia"
                >
                  <User className="size-4" />
                </button>
                <button
                  type="button"
                  className={cn(s.isBot && "play-toggle-on")}
                  onClick={() => update(i, { isBot: true, name: s.isBot ? s.name : BOT_NAMES[i] })}
                  aria-pressed={s.isBot}
                  aria-label="Bot"
                  title="Bot"
                >
                  <Bot className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
