import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, KeyRound, BriefcaseBusiness, ChevronRight, CircleHelp, Coins, GraduationCap, HeartHandshake, Landmark, Leaf, Map as MapIcon, Play, Trophy, Users, Vote } from "lucide-react";
import { PlayerAvatar } from "@/seratus/components/game/PlayerAvatar";
import { SoundToggle } from "@/seratus/components/SoundToggle";
import splash from "@/seratus/assets/beranda-game-splash.jpg";
import logoUrl from "@/seratus/assets/logo-100-suara.png";
const logo = { url: logoUrl };

export const Route = createFileRoute("/seratus/")({
  head: () => ({
    meta: [
      { title: "100 SUARA — Bangun Bangsa · Permainan Edukasi Demokrasi" },
      { name: "description", content: "Lima pemain, lima bidang kebijakan, seratus suara. Bermain bersama atau berlatih dengan bot dalam permainan edukasi demokrasi 100 SUARA." },
      { property: "og:title", content: "100 SUARA — Bangun Bangsa" },
      { property: "og:description", content: "Kumpulkan aspirasi, hadapi Putusan Rakyat, dan bangun kepercayaan lewat permainan demokrasi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const AREAS = [
  { name: "Pendidikan", icon: GraduationCap, avatar: 0, motto: "Cerdaskan Bangsa" },
  { name: "Lingkungan", icon: Leaf, avatar: 4, motto: "Rawat Bumi" },
  { name: "Ekonomi", icon: BriefcaseBusiness, avatar: 2, motto: "Sejahtera Bersama" },
  { name: "Layanan Publik", icon: Landmark, avatar: 3, motto: "Melayani Sepenuh Hati" },
  { name: "Inklusivitas", icon: HeartHandshake, avatar: 5, motto: "Semua Ikut Bersuara" },
];



const STATS = [
  { icon: Vote, value: 100, label: "Suara" },
  { icon: Users, value: 5, label: "Pemain" },
  { icon: MapIcon, value: 5, label: "Bidang" },
];

const TILES = [
  { to: "/", label: "Kaya Raya", icon: Coins },
  { to: "/seratus/kunci-jawaban", label: "Kunci Jawaban", icon: KeyRound },
  { to: "/seratus/peringkat", label: "Peringkat", icon: Trophy },
  { to: "/seratus/tentang", label: "Tentang", icon: CircleHelp },
] as const;

/** Mouse parallax: the artwork and sparks drift gently with the cursor (desktop pointers only). */
function useParallax() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--px", (e.clientX / window.innerWidth - 0.5).toFixed(3));
        el.style.setProperty("--py", (e.clientY / window.innerHeight - 0.5).toFixed(3));
      });
    };
    const reset = () => { el.style.setProperty("--px", "0"); el.style.setProperty("--py", "0"); };
    window.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", reset);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("pointermove", move); document.removeEventListener("pointerleave", reset); };
  }, []);
  return ref;
}

function Index() {
  const parallax = useParallax();
  return (
    <div className="home-page" ref={parallax}>
      <img src={splash} width={1920} height={1088} alt="Pulau papan permainan 100 SUARA dengan lima bidang, pion, dadu, dan token suara" className="home-art" fetchPriority="high" />
      <div className="home-shade" aria-hidden />

      <header className="home-top">
        <Link to="/seratus" className="home-brand" aria-label="100 SUARA, beranda">
          <img src={logo.url} alt="" className="home-brand-logo" width={900} height={574} />
        </Link>
        <div className="home-stats">
          {STATS.map((s) => (
            <span key={s.label} className="home-stat" title={`${s.value} ${s.label}`}>
              <span className="home-stat-icon"><s.icon /></span>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </span>
          ))}
          <SoundToggle className="info-back home-sound" />
        </div>
      </header>

      <main className="home-stage">
        <section className="home-menu" aria-label="Menu utama">
          <div className="home-intro">
            <h1 className="home-logo">
              <img src={logo.url} alt="100 SUARA — Bangun Bangsa" className="home-logo-img" width={900} height={574} />
            </h1>
            <p className="home-tag">Kumpulkan suara rakyat, tembus Gerbang Demokrasi, dan menangkan kepercayaan bangsa.</p>
          </div>

          <div className="home-actions">
            <Link to="/seratus/main" className="home-btn home-play">
              <span className="home-play-icon"><Play /></span>
              <span className="home-btn-label"><b>MAIN BERSAMA</b><small>Ruang privat · 5 pemain</small></span>
              <ChevronRight className="home-btn-arrow" />
            </Link>
            <Link to="/seratus/main" search={{ mode: "bot" }} className="home-btn home-alt">
              <span className="home-alt-icon"><Bot /></span>
              <span className="home-btn-label"><b>LATIHAN VS BOT</b><small>Main sendiri, kapan saja</small></span>
              <ChevronRight className="home-btn-arrow" />
            </Link>
            <nav className="home-tiles" aria-label="Menu lainnya">
              {TILES.map((t) => <Link key={t.to} to={t.to} className="home-tile"><t.icon />{t.label}</Link>)}
            </nav>
          </div>
        </section>

        <aside className="home-roster" aria-label="Lima bidang kebijakan">
          <span className="home-roster-label">5 BIDANG · 1 BANGSA</span>
          <div className="home-roster-list">
            {AREAS.map((a, i) => (
              <div key={a.name} className="home-hero">
                <PlayerAvatar area={i} avatar={a.avatar} size={52} />
                <span><a.icon />{a.name}</span>
                <small className="home-hero-motto">{a.motto}</small>
              </div>
            ))}
          </div>
        </aside>
      </main>

      <footer className="home-credit">Amanda Nisa Hafiza · Ayla Sabrina · Miranda Amalia · Universitas Borneo Lestari</footer>
    </div>
  );
}
