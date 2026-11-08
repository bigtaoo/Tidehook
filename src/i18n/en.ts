// The source string table. Every other locale is typed as Table, so a missing or extra key is a
// compile error. Leave room: German and Russian run about 30% longer (docs/00-art-direction.md).
export const en = {
  title: 'Tidehook',
  lang: { name: 'English' },
  boot: {
    tapToStart: 'Tap to cast',
    failed: 'Could not start: {error}',
  },
  hud: {
    wave: 'Wave {n}',
    gold: '{n} gold',
    pause: 'Pause',
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Table = Widen<typeof en>;
