// The dev server's end of the store screenshots (docs/05-store.md): POST /__shot?name=<name> with
// a PNG data URL as the body writes art/store/<name>.png. The portal's publication form wants
// screenshots of the real game, and the game draws itself, so they are taken from the renderer
// rather than from a window: the page resizes the renderer to the size the store asks for, draws
// one frame and posts it. Only `vite` (serve) loads this, so nothing of it reaches a build.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** A name is a file, never a path: letters, digits, dash and underscore only. */
export function shotName(raw) {
  const name = String(raw ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
  return name.slice(0, 48) || 'shot';
}

/** The PNG bytes in a data URL, or null when the body is not one. */
export function shotBytes(body) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(body ?? '').trim());
  return m ? Buffer.from(m[1], 'base64') : null;
}

/** The Vite plugin. */
export function shotSink(dir) {
  return {
    name: 'tidehook-shot-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c) => {
          if (body.length < 32 << 20) body += c;
        });
        req.on('end', () => {
          const png = shotBytes(body);
          const name = shotName(new URL(req.url ?? '', 'http://x').searchParams.get('name'));
          if (png) {
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, `${name}.png`), png);
            console.info(`shot: ${join(dir, `${name}.png`)}, ${(png.length / 1024).toFixed(0)} kB`);
          }
          res.statusCode = png ? 204 : 400;
          res.end();
        });
      });
    },
  };
}
