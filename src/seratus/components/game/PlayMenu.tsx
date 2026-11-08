import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { KeyRound, Bot, Home, Users, type LucideIcon } from 'lucide-react';
import splash from '@/seratus/assets/beranda-game-splash.jpg';
import logoUrl from "@/seratus/assets/logo-100-suara.png";
const logo = { url: logoUrl };
import { SoundToggle } from '@/seratus/components/SoundToggle';
import { cn } from '@/lib/utils';

export type PlayMode = 'online' | 'local';
type ModeProps = { mode: PlayMode; setMode: (m: PlayMode) => void };

const MODES = [
  { id: 'online', label: 'Main Bersama', icon: Users },
  { id: 'local', label: 'Latihan vs Bot', icon: Bot },
] as const;

/** Pre-game screens of /main (room entry, waiting room, practice setup): same dark game look as the title screen. */
export function PlayMenu({ mode, setMode, children }: ModeProps & { children: ReactNode }) {
  return (
    <div className="info-screen play-screen dark">
      <img src={splash} width={1920} height={1088} alt="" className="info-art" />
      <div className="info-shade" aria-hidden />
      <header className="info-top">
        <Link to="/seratus" className="info-back" aria-label="Kembali ke beranda" title="Beranda"><Home /></Link>
        <div className="info-tabs" role="group" aria-label="Cara bermain">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={cn('info-tab', mode === m.id && 'info-tab-active')}>
              <m.icon /><span>{m.label}</span>
            </button>
          ))}
        </div>
        <Link to="/seratus/kunci-jawaban" className="info-back play-guide" aria-label="Kunci jawaban" title="Kunci Jawaban"><KeyRound /></Link>
        <SoundToggle className="info-back" />
      </header>
      <main className="info-main">
        <section className="info-panel play-panel">{children}</section>
      </main>
    </div>
  );
}

export function PlayHeading({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle: ReactNode; children?: ReactNode }) {
  return (
    <header className="info-heading">
      <span className="info-heading-icon"><Icon /></span>
      <div className="min-w-0 flex-1"><h1>{title}</h1><p>{subtitle}</p></div>
      {children}
    </header>
  );
}

const NIGHT_CLASSES = ['dark', 'game-night'];
const COMPACT_KEY = '100suara:game-compact';

/** Whether the game page's top bar is minimized so the table can use the full screen; null outside GameLayout. */
const GameChromeContext = createContext<{ compact: boolean; setCompact: (v: boolean) => void } | null>(null);
export const useGameChrome = () => useContext(GameChromeContext);

/** Active game: same tabletop layout on the dark night table, with a compact game bar (Home, mode tabs, key, sound). */
export function GameLayout({ mode, setMode, children }: ModeProps & { children: ReactNode }) {
  // Dialogs and popovers render outside this wrapper, so the night tokens also go on <html> while a game is open.
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add(...NIGHT_CLASSES);
    return () => el.classList.remove(...NIGHT_CLASSES);
  }, []);
  // Read after hydration so server and browser render the same markup first.
  const [compact, setCompactState] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem(COMPACT_KEY);
    // A new session maximizes the board; an explicit menu choice is retained.
    if (saved !== '0') setCompactState(true);
  }, []);
  const setCompact = (v: boolean) => {
    setCompactState(v);
    window.localStorage.setItem(COMPACT_KEY, v ? '1' : '0');
  };
  return (
    <GameChromeContext.Provider value={{ compact, setCompact }}>
    <div className={cn("desktop-game-page game-night dark min-h-screen lg:flex lg:h-dvh lg:min-h-0 lg:flex-col lg:overflow-hidden", compact && "game-compact")}>
      <div className="game-night-bg" aria-hidden>
        <img src={splash} width={1920} height={1088} alt="" className="game-night-art" />
        <div className="game-night-shade" />
      </div>
      <header className="info-top game-top">
        <Link to="/seratus" className="game-top-brand" aria-label="100 SUARA, kembali ke beranda" title="Beranda">
          <img src={logo.url} alt="100 SUARA — Bangun Bangsa" width={900} height={574} />
        </Link>
        <div className="info-tabs" role="group" aria-label="Cara bermain">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={cn('info-tab', mode === m.id && 'info-tab-active')}>
              <m.icon /><span>{m.label}</span>
            </button>
          ))}
        </div>
        <Link to="/seratus" className="info-back game-top-home" aria-label="Kembali ke beranda" title="Beranda"><Home /></Link>
        <Link to="/seratus/kunci-jawaban" className="info-back" aria-label="Kunci jawaban" title="Kunci Jawaban"><KeyRound /></Link>
        <SoundToggle className="info-back" />
      </header>
      {children}
    </div>
    </GameChromeContext.Provider>
  );
}
