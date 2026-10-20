import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

// This generator is separate from the application build. It never starts an API,
// authenticates a user, collects credentials, or enables a payment provider.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(root, '.runtime');
await mkdir(runtime, { recursive: true });
const entry = resolve(runtime, 'homepage-preview-entry.tsx');
const output = resolve(runtime, 'industryconnect-homepage-preview.html');
const image = await readFile(resolve(root, 'apps/web/public/images/conversation.webp'));
const favicon = await readFile(resolve(root, 'apps/web/public/favicon.svg'));
const categories = [
  'Career & leadership',
  'Technology',
  'Business & startups',
  'Design & creative',
].map((name, index) => ({ _id: 'demo-category-' + index, name }));
const experts = [
  ['Ananya Rao', 'Product strategy & your next career chapter', 'Product career clarity', 149900],
  [
    'Arjun Mehta',
    'Build better systems. Make better technical decisions.',
    'System design deep dive',
    199900,
  ],
  ['Maya Shah', 'A sounding board for your next business move', 'Founder office hours', 249900],
  ['Rohan Iyer', 'Turn a good portfolio into a compelling story', 'Portfolio review', 99900],
].map(([name, headline, title, pricePaise], index) => ({
  id: 'demo-expert-' + index,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  name,
  headline,
  city: 'Hyderabad',
  experienceYears: 8 + index,
  languages: ['English', 'Telugu'],
  rating: null,
  reviewCount: 0,
  categoryId: categories[index]._id,
  services: [
    { id: 'demo-service-' + index, title, pricePaise, mode: 'online', durationMinutes: 45 },
  ],
}));
await writeFile(
  entry,
  `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { HomePage } from '../apps/web/src/HomePage.tsx';
import { SiteHeader, SiteFooter } from '../apps/web/src/SiteShell.tsx';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../apps/web/src/styles.css';
import '../apps/web/src/homepage.css';
const categories = ${JSON.stringify(categories)};
const experts = ${JSON.stringify(experts)};
window.fetch = async (input, options = {}) => {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const url = new URL(String(input), 'https://preview.invalid');
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  if (options.method && options.method !== 'GET') return json({ error: { message: 'This design preview does not submit data.' } }, 405);
  if (url.pathname === '/api/config') return json({ checkoutEnabled: false, betaAccess: 'invite' });
  if (url.pathname === '/api/categories') return json({ items: categories, total: categories.length });
  if (url.pathname === '/api/experts') {
    const p = url.searchParams;
    const words = (p.get('q') || '').toLowerCase().split(/\\s+/).filter(Boolean);
    const items = experts.filter(e => {
      const text = [e.name, e.headline, ...e.services.map(s => s.title)].join(' ').toLowerCase();
      return words.every(word => text.includes(word)) &&
        (!p.get('category') || e.categoryId === p.get('category')) &&
        (!p.get('language') || e.languages.includes(p.get('language'))) &&
        e.services.some(s => (!p.get('mode') || s.mode === p.get('mode')) && (!p.get('maxPrice') || s.pricePaise <= Number(p.get('maxPrice'))));
    });
    return json({ items, total: items.length });
  }
  return json({ error: { message: 'This action is available in the full application.' } }, 404);
};
function Destination() {
  return <main className="market-home" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: '64px 24px' }}><div style={{ maxWidth: 560 }}>
    <p className="hc-kicker">HOMEPAGE DESIGN PREVIEW</p>
    <h1 style={{ fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.04em' }}>Your next step is in the full app.</h1>
    <p style={{ margin: '24px 0', lineHeight: 1.8 }}>This standalone preview shows the homepage, search, filters, navigation, and FAQs using fictional profiles. Sign-in, expert details, and booking flows run in the full IndustryConnect application.</p>
    <Link className="hc-button" to="/">Back to the homepage →</Link>
    <p style={{ marginTop: 24 }}><a href="https://github.com/mynameiscod/IndustryConnect" target="_blank" rel="noreferrer">Open the project on GitHub ↗</a></p>
  </div></main>;
}
createRoot(document.getElementById('root')).render(<MemoryRouter>
  <div style={{ padding: '9px 20px', background: '#ebe5da', color: '#343a35', textAlign: 'center', font: '12px/1.5 system-ui' }}>Design preview · Fictional demo profiles · No sign-in, bookings, or payments</div>
  <SiteHeader user={null} onSignOut={async () => {}} />
  <Routes><Route path="/" element={<main id="main"><HomePage /></main>} /><Route path="*" element={<Destination />} /></Routes>
  <SiteFooter />
</MemoryRouter>);
`,
);
const result = await build({
  root,
  configFile: false,
  plugins: [react()],
  logLevel: 'warn',
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    write: false,
    minify: true,
    lib: { entry, name: 'IndustryConnectPreview', formats: ['iife'] },
  },
});
const chunks = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
const css = chunks
  .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
  .map((item) => item.source)
  .join('\n');
const code = chunks
  .filter((item) => item.type === 'chunk')
  .map((item) => item.code)
  .join('\n')
  .replaceAll('/images/conversation.webp', 'data:image/webp;base64,' + image.toString('base64'))
  .replaceAll('</script', '<\\/script');
const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#242a27"><title>IndustryConnect — Homepage design preview</title><link rel="icon" href="data:image/svg+xml;base64,${favicon.toString('base64')}"><style>${css}</style></head><body><div id="root"></div><script>${code}</script></body></html>`;
await writeFile(output, html);
console.info('Self-contained homepage preview: ' + output);
console.info(
  'Fictional profiles only; no external assets, API calls, credentials, or transactions.',
);
