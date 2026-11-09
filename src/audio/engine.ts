// The speakers: Web Audio for the effects, a streamed <audio> element for the music (decoding 86 s
// of stereo would hold some 30 MB). Browsers keep audio locked until the player touches the page,
// so nothing is created before unlock(); every call before then is dropped, quietly.

import { CUES, cueFile, MUSIC_FILE, VARIANTS, type Cue } from './cues';
import type { AudioOut } from './sound';

/** Mix levels, 0-1. */
const SFX_GAIN = 0.8;
const MUSIC_GAIN = 0.32;
/** The most effects sounding at once; a new one past this is dropped. */
const MAX_VOICES = 12;

type Ctx = typeof AudioContext;

export class WebAudioOut implements AudioOut {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  /** When each sounding effect ends, on the context's clock: a count kept by onended would leak
   *  a voice for every end event a browser drops. */
  private ends: number[] = [];
  private audible = false;
  private loading = false;

  /** Wires the unlock to the first touch, click or key on `target`. */
  listen(target: Pick<Window, 'addEventListener' | 'removeEventListener'>): void {
    const events = ['pointerdown', 'keydown', 'touchend'] as const;
    const go = () => {
      this.unlock();
      if (this.ctx?.state === 'running') for (const e of events) target.removeEventListener(e, go, true);
    };
    for (const e of events) target.addEventListener(e, go, true);
  }

  /** Creates or resumes the audio inside a user gesture, then loads the sounds once. */
  unlock(): void {
    if (!this.ctx) {
      const C: Ctx | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctx }).webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = SFX_GAIN;
      this.sfx.connect(this.ctx.destination);
      const m = new Audio(MUSIC_FILE);
      m.loop = true;
      m.preload = 'auto';
      // through the graph, not m.volume: iOS ignores that
      const mg = this.ctx.createGain();
      mg.gain.value = MUSIC_GAIN;
      mg.connect(this.ctx.destination);
      this.ctx.createMediaElementSource(m).connect(mg);
      this.music = m;
    }
    if (this.audible) this.wake();
    if (!this.loading) {
      this.loading = true;
      void this.load();
    }
  }

  setAudible(on: boolean): void {
    this.audible = on;
    if (on) this.wake();
    else {
      void this.ctx?.suspend().catch(() => {});
      this.music?.pause();
    }
  }

  play(cue: Cue, i: number, rate: number, gain: number): void {
    const ctx = this.ctx;
    const buf = this.buffers.get(cueFile(cue, i));
    if (!ctx || !this.sfx || !buf || !this.audible || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    this.ends = this.ends.filter((e) => e > now);
    if (this.ends.length >= MAX_VOICES) return;
    this.ends.push(now + buf.duration / rate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    let out: AudioNode = this.sfx;
    if (gain < 1) {
      const g = ctx.createGain();
      g.gain.value = gain;
      g.connect(this.sfx);
      out = g;
    }
    src.connect(out);
    src.onended = () => {
      src.disconnect();
      if (out !== this.sfx) out.disconnect();
    };
    src.start();
  }

  private wake(): void {
    void this.ctx?.resume().catch(() => {});
    // play() fails outside a gesture on some browsers; the next touch calls unlock() again
    void this.music?.play().catch(() => {});
  }

  private async load(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const files = CUES.flatMap((c) => Array.from({ length: VARIANTS[c] }, (_, i) => cueFile(c, i)));
    await Promise.all(
      files.map(async (f) => {
        try {
          const res = await fetch(f);
          if (!res.ok) return;
          // the callback form: older Safari has no promise from decodeAudioData
          const data = await res.arrayBuffer();
          const buf = await new Promise<AudioBuffer>((ok, fail) => ctx.decodeAudioData(data, ok, fail));
          this.buffers.set(f, buf);
        } catch {
          /* a sound that does not load stays silent */
        }
      }),
    );
  }
}
