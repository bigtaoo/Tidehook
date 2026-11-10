import { defineConfig } from 'vite';
import { buildDefine } from './scripts/buildId.mjs';
import { recSink } from './scripts/rec/sink.mjs';

// The Playgama build, after Potion Siege's (D:\fang\vite.playgama.config.js): `npm run
// build:playgama` writes dist-playgama/ and zips it into tidehook-playgama.zip
// (scripts/packPlaygama.mjs), index.html at the archive's root.
//  1. base './': the portal serves the upload from a path of its choosing;
//  2. the entry is src/main.playgama.ts instead of src/main.ts;
//  3. the Bridge SDK <script> (Playgama's CDN, its current stable v2) is the first script in
//     <head>, not async, as Playgama's docs ask;
//  4. playgama-bridge-config.json sits next to index.html, where Bridge reads it from.
// The build fails if the HTML was never rewritten, rather than ship a game without the SDK
// (Playgama refuses such a build). The dev server keeps the tap recorder's sink, as the web one.

const SDK_TAG = '<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>';
const DEFAULT_ENTRY = '/src/main.ts';
const PORTAL_ENTRY = '/src/main.playgama.ts';

/** Interstitials no closer than a minute apart (Bridge's own default, made explicit): the game
 *  asks at every natural break (src/game/ads.ts) and leaves the pacing to Bridge. The daily voyage's
 *  leaderboard (src/game/board.ts) is a Bridge SaaS one: Playgama has no leaderboard of its own. It
 *  needs the game's public SaaS token from the developer console (Bridge SaaS, Leaderboards), given
 *  as PLAYGAMA_SAAS_TOKEN at build time; without it Bridge reports no leaderboard and the game
 *  shows none. The one product, remove_ads (src/game/noAds.ts), is listed here by id only; its price,
 *  title and description are the developer console's (In-app purchases). */
export function bridgeConfig(token = process.env.PLAYGAMA_SAAS_TOKEN) {
  const config = {
    advertisement: { minimumDelayBetweenInterstitial: 60 },
    leaderboards: [{ id: 'daily' }],
    payments: [{ id: 'remove_ads' }],
  };
  if (token) config.saas = { publicToken: token, leaderboards: { platforms: ['playgama', 'qa_tool'] } };
  return config;
}
export const BRIDGE_CONFIG = bridgeConfig();

export function rewritePlaygamaHtml(html) {
  let out = html;
  if (out.includes(DEFAULT_ENTRY)) out = out.replace(DEFAULT_ENTRY, PORTAL_ENTRY);
  if (!out.includes('bridge.playgama.com')) out = out.replace('</title>', `</title>\n    ${SDK_TAG}`);
  return out;
}

const playgama = () => {
  let applied = false;
  const apply = (html) => {
    const out = rewritePlaygamaHtml(html);
    if (out.includes(PORTAL_ENTRY) && out.includes('bridge.playgama.com')) applied = true;
    return out;
  };
  return {
    name: 'playgama-html',
    enforce: 'pre',
    // a build reaches the html through transform, dev through transformIndexHtml
    transform(code, id) {
      return id.endsWith('.html') ? apply(code) : null;
    },
    transformIndexHtml: apply,
    configureServer(server) {
      server.middlewares.use('/playgama-bridge-config.json', (_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(BRIDGE_CONFIG));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'playgama-bridge-config.json', source: JSON.stringify(BRIDGE_CONFIG, null, 2) });
    },
    closeBundle() {
      if (!applied) throw new Error('vite.playgama.config.js: index.html was never rewritten for Playgama');
    },
  };
};

export default defineConfig({
  base: './',
  define: buildDefine(),
  plugins: [playgama(), recSink('recordings')],
  server: { port: 5191, host: true, watch: { ignored: ['**/recordings/**'] } },
  build: { target: 'es2020', outDir: 'dist-playgama', emptyOutDir: true },
});
