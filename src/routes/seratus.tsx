import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/seratus')({
  head: () => ({ meta: [
    { title: '100 SUARA — Bangun Bangsa' },
    { name: 'description', content: 'Permainan edukasi demokrasi 100 SUARA: bermain bersama atau berlatih melawan bot.' },
    { property: 'og:title', content: '100 SUARA — Bangun Bangsa' },
    { property: 'og:description', content: 'Lima bidang kebijakan, lima pemain, dan seratus suara untuk bangsa.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Outlet,
});