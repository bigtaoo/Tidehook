import { describe, expect, it } from 'vitest';
import type { BootScreen } from '../boot/screen';
import { StubPlatform } from '../platform/stub';
import { BootTrack, errorKind } from './bootTrack';

/** A loading page that remembers what the boot asked of it. */
function screen(): BootScreen & { failed: boolean; ended: boolean } {
  const s = {
    t0: Date.now(),
    failed: false,
    ended: false,
    at: () => 0.4,
    started() {},
    set() {},
    fail() {
      s.failed = true;
    },
    done() {
      s.ended = true;
    },
  };
  return s;
}

function setup() {
  const host = new StubPlatform();
  const page = screen();
  const win = { addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 390, innerHeight: 844 };
  const doc = { addEventListener: () => {}, removeEventListener: () => {}, visibilityState: 'visible' as DocumentVisibilityState };
  const track = new BootTrack(host, page, 'test', win, doc);
  return { host, page, track };
}

describe('BootTrack', () => {
  it('tells the host the game is ready when boot gives up, so the retry is reachable', () => {
    const { host, page, track } = setup();
    track.stage('gpu');
    track.failed(new Error('no webgl context'));
    expect(page.failed).toBe(true);
    // without this the host's own loading cover stays over the retry button for ever
    expect(host.calls).toContain('loaded');
    const [[event, data]] = host.tracked;
    expect(event).toBe('boot_error');
    expect(data.stage).toBe('gpu');
    expect(data.kind).toBe('webgl');
  });

  it('reports the boot once, however it ended', () => {
    const { host, track } = setup();
    track.failed(new Error('boom'));
    track.failed(new Error('boom again'));
    track.loaded();
    expect(host.tracked.map(([e]) => e)).toEqual(['boot_error']);
    expect(host.calls.filter((c) => c === 'loaded')).toHaveLength(1);
  });

  it('keeps the error kinds to the three words', () => {
    expect(errorKind(new TypeError('failed to fetch'))).toBe('fetch');
    expect(errorKind(new Error('WebGL unsupported'))).toBe('webgl');
    expect(errorKind('something else entirely')).toBe('other');
  });
});
