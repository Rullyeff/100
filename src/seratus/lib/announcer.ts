import start from '@/seratus/assets/announcer/start.mp3.asset.json';
import toll from '@/seratus/assets/announcer/toll.mp3.asset.json';
import landmark from '@/seratus/assets/announcer/landmark.mp3.asset.json';
import bankrupt from '@/seratus/assets/announcer/bankrupt.mp3.asset.json';
import { isMuted, subscribeMuted } from './sfx';
import type { Cue } from '@/seratus/components/game/arcade-events';
export const CUE_LABEL: Record<Cue, string> = { start: 'Game Start!', toll: 'Toll payment!', landmark: 'Landmark!', bankrupt: 'Bankrupt!' };
const sourceClips = { start, toll, landmark, bankrupt };
// Source-project CDN objects are not accessible from this project. Keep their
// metadata for byte import, but do not issue broken audio requests meanwhile.
const clips: Partial<Record<Cue, { url: string }>> = Object.fromEntries(
  Object.entries(sourceClips).filter(([, asset]) => asset.project_id === '3a2321db-f960-455a-8639-5ab9b36029b3'),
);
/** One voice bus, cancelled on hide/mute; generated once, never billed during play. */
export function createAnnouncer() {
  let voice: HTMLAudioElement | null = null;
  let queue: Cue[] = [];
  const stop = () => { queue = []; if (voice) { voice.pause(); voice.onended = null; voice = null; } };
  const next = () => {
    if (isMuted() || document.hidden) { stop(); return; }
    const cue = queue.shift(); if (!cue) { voice = null; return; }
    const clip = clips[cue]; if (!clip) { next(); return; }
    voice = new Audio(clip.url); voice.volume = 0.8; voice.onended = next;
    void voice.play().catch(stop);
  };
  const unsubscribe = subscribeMuted(() => { if (isMuted()) stop(); });
  const hidden = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', hidden);
  return { say: (cue: Cue) => { if (isMuted() || document.hidden) return; queue = [...queue, cue].slice(-4); if (!voice) next(); },
    dispose: () => { stop(); unsubscribe(); document.removeEventListener('visibilitychange', hidden); } };
}