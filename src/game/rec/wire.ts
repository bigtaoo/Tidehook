// The tap recorder and the wave log (waveLog.ts), on in every dev build (?rec=0 turns it off; a release never has it): posts its
// records to the dev server, which appends them to recordings/rec-<date>.ndjson
// (scripts/rec/sink.mjs). On by default so a game played to show a problem is never lost to a
// missing switch.

import type { SimEvent } from '../../sim/events';
import type { Session } from '../session';
import { TapRecorder } from './recorder';
import { WaveLog } from './waveLog';

export interface RecScreen {
  w: number;
  h: number;
  wide: boolean;
}

/** Starts recording, or returns null in a release or with ?rec=0. The result goes in the ticker. */
export function startRecording(
  params: URLSearchParams,
  session: Session,
  screen: () => RecScreen,
  build: string,
  lagMs: number | undefined,
): ((frameMs: number, events: readonly SimEvent[]) => void) | null {
  if (!import.meta.env.DEV || params.get('rec') === '0') return null;
  const url = new URL('__rec', location.href).toString();
  const send = (rec: object) => {
    void fetch(url, { method: 'POST', body: JSON.stringify(rec), keepalive: true }).catch(() => {});
  };
  send({ k: 'start', at: new Date().toISOString(), build, lag: lagMs ?? 0, ua: navigator.userAgent, ...screen() });
  const rec = new TapRecorder((r) => send({ ...r, scr: screen() }));
  session.tapWatch = (t) => rec.tap(session, t);
  const waves = new WaveLog((r) => send(r));
  return (frameMs, events) => {
    rec.frame(session, frameMs, events);
    waves.frame(session.world, events);
  };
}
