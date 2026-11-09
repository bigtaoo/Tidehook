// The dev server's end of the tap recorder (src/game/rec/): POST /__rec appends the body,
// one JSON object, as a line of recordings/rec-<date>.ndjson. Only `vite` (serve) loads it, so
// nothing of it reaches a build.

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** The file a record lands in on a given day. */
export function recFile(dir, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  return join(dir, `rec-${day}.ndjson`);
}

/** One request body to one NDJSON line, or null when it is not a JSON object. */
export function recLine(body) {
  try {
    const v = JSON.parse(body);
    return v && typeof v === 'object' && !Array.isArray(v) ? `${JSON.stringify(v)}\n` : null;
  } catch {
    return null;
  }
}

/** The Vite plugin. */
export function recSink(dir) {
  return {
    name: 'tidehook-rec-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__rec', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c) => {
          if (body.length < 1 << 20) body += c;
        });
        req.on('end', () => {
          const line = recLine(body);
          if (line) {
            mkdirSync(dir, { recursive: true });
            appendFileSync(recFile(dir), line);
          }
          res.statusCode = line ? 204 : 400;
          res.end();
        });
      });
    },
  };
}
