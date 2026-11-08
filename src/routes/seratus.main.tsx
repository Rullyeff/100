import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GameScreen } from "@/seratus/components/game/GameScreen";
import { SetupScreen } from "@/seratus/components/game/SetupScreen";
import { useGame } from "@/seratus/components/game/useGame";
import { RoomLobby } from '@/seratus/components/game/RoomLobby';
import { GameLayout, PlayMenu, type PlayMode } from '@/seratus/components/game/PlayMenu';

export const Route = createFileRoute("/seratus/main")({
  head: () => ({
    meta: [
      { title: "Ruang Permainan — 100 SUARA Bangun Bangsa" },
      { name: "description", content: "Buat atau gabung ruang privat lima pemain 100 SUARA dengan kode undangan, voting rahasia, dan 100 token suara." },
      { property: "og:title", content: "Ruang Permainan — 100 SUARA Bangun Bangsa" },
      { property: "og:description", content: "Bermain bersama di lima perangkat atau berlatih dengan bot dalam permainan edukasi demokrasi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { mode?: "bot" } => (search["mode"] === "bot" ? { mode: "bot" } : {}),
  component: MainPage,
});

function Practice({ mode, setMode }: { mode: PlayMode; setMode: (m: PlayMode) => void }) {
  const g = useGame();
  const [testDice] = useState(false);
  if (!g.state) {
    return (
      <PlayMenu mode={mode} setMode={setMode}>
        <SetupScreen onStart={(c) => g.start(c)} saved={g.saved} onResume={g.resume} error={g.error} />
      </PlayMenu>
    );
  }
  return (
    <GameLayout mode={mode} setMode={setMode}>
      <div className="min-h-0 lg:flex lg:flex-1 lg:flex-col lg:overflow-y-auto">
        {g.error && <p role="alert" className="mx-auto max-w-3xl p-4 text-destructive">{g.error}</p>}
        <GameScreen
          key={g.state.order.join() + g.state.players.map((p) => p.name).join()}
          state={g.state}
          dispatch={g.dispatch}
          error={g.error}
          speed={g.speed}
          setSpeed={g.setSpeed}
          paused={g.paused}
          setPaused={g.setPaused}
          onQuit={g.quit}
          onRestart={g.restart}
          testDice={testDice}
          localBusy={g.busy}
          localActor={g.actor}
        />
      </div>
    </GameLayout>
  );
}

function MainPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<PlayMode>(search.mode === 'bot' ? 'local' : 'online');
  return mode === 'online' ? <RoomLobby mode={mode} setMode={setMode} /> : <Practice mode={mode} setMode={setMode} />;
}
