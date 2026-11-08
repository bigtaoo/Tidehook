// 原型2 无头模拟：node tools/sim2.js <persona> <games> <seed0>
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'v2.html'), 'utf8');
const code = html.split('<script>')[1].split('</script>')[0];
const [persona = 'good', games = 20, seed0 = 1] = process.argv.slice(2);
const MAXWAVE = +process.env.MAXWAVE || 30;

function makeGame(seed) {
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {}, width: 0 }) });
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 800 }) };
  const g = { innerWidth: 480, innerHeight: 800, devicePixelRatio: 1, addEventListener() {}, requestAnimationFrame() {},
    localStorage: { getItem() { return null; }, setItem() {} }, Date, Math,
    document: { getElementById: () => canvas, createElement: () => canvas } };
  g.window = g; vm.createContext(g); vm.runInContext(code, g);
  const HD = g.HD; HD.seed(seed); HD.startGame(); return HD;
}

const PRIO = ['grip', 'rock', 'barb', 'magnet', 'winch', 'vein', 'multi', 'speed', 'pierce', 'blast', 'armor', 'swing', 'lure'];
function shop(HD, p) {
  const S = HD.S;
  while (S.hp <= S.maxHp - 3 && HD.buyFix('repair'));
  if (p.bombs && S.bombs < 1) HD.buyFix('bomb');
  for (let pass = 0; pass < 6; pass++) {
    let bought = false;
    const order = S.cards.map((c, i) => [i, PRIO.indexOf(c.u.id)]).filter(x => x[1] >= 0).sort((a, b) => a[1] - b[1]);
    for (const [i] of order) if (HD.buy(i)) { bought = true; break; }
    if (!bought) { if (p.reroll && S.gold > 60 && HD.reroll()) continue; break; }
  }
  if (p.bombs) while (S.bombs < 3 && S.gold > HD.bombCost() * 2 && HD.buyFix('bomb'));
  if (S.hp < S.maxHp && S.gold > HD.repairCost() * 2) HD.buyFix('repair');
  HD.startWave();
}

function run(seed, pname) {
  const HD = makeGame(seed), dt = 1 / 60;
  const [base, ...mods] = pname.split('-');
  const p = { ...{ good: { react: 0.1, err: 0.02, rocks: true, gold: true, reroll: true, bombs: true },
    casual: { react: 0.3, err: 0.07, rocks: true, gold: true, reroll: false, bombs: false },
    spam: { react: 0.15, err: 0.1, rocks: false, gold: true, reroll: false, spam: true } }[base] };
  if (mods.includes('norock')) p.rocks = false;
  if (mods.includes('nogold')) p.gold = false;
  let cd = 0, t = 0;
  const waves = [];
  while (t < 3600) {
    const S = HD.S;
    if (S.phase === 'over' || S.wave > MAXWAVE) break;
    if (S.phase === 'shop') { waves.push({ w: S.wave, hp: S.hp, gold: S.gold }); shop(HD, p); continue; }
    cd -= dt;
    if (S.hook.st === 'swing' && cd <= 0) {
      cd = p.react;
      const ang = S.hook.ang + (Math.random() - .5) * 2 * p.err;
      const mons = S.mons.filter(m => m.y < 820 && m.x > -5 && m.x < 485);
      const near = mons.some(m => Math.hypot(m.x - HD.OX, m.y - HD.OY) < 300);
      const heavy = mons.some(m => !HD.grabbable(m));
      let go = false;
      if (p.spam) go = Math.random() < .3;
      else if (S.held) {
        const r = HD.rayFirst(ang, true);
        if (r && (!HD.grabbable(r.o) || r.len < 200 || !p.rocks)) go = true;
      } else {
        const r = HD.rayFirst(ang, false);
        if (r) {
          const o = r.o;
          if (!o.kind) go = HD.grabbable(o) || o.hp <= S.up.hookDmg || r.len < 220 || !p.rocks;
          else if (o.kind === 'rock') go = p.rocks && heavy;
          else go = p.gold && !near && !(o.big && near);
        }
      }
      if (go) HD.fire();
    }
    HD.update(dt); t += dt;
  }
  const S = HD.S;
  return { wave: S.wave, over: S.phase === 'over', st: S.st, lv: S.lv, up: S.up, waves, t: Math.round(t) };
}

const res = [];
for (let i = 0; i < +games; i++) res.push(run(+seed0 + i, persona));
const w = res.map(r => r.wave).sort((a, b) => a - b), q = x => w[Math.min(w.length - 1, Math.floor(x * w.length))];
const avg = f => (res.reduce((a, r) => a + f(r), 0) / res.length);
console.log(persona.padEnd(7), 'wave p10/25/50/75/90', q(.1), q(.25), q(.5), q(.75), q(.9),
  '| min/game', (avg(r => r.t) / 60).toFixed(1),
  '| kills', avg(r => r.st.kills).toFixed(0), 'crush%', (100 * avg(r => r.st.crush / Math.max(1, r.st.kills))).toFixed(0),
  'rockKill%', (100 * avg(r => r.st.rockKills / Math.max(1, r.st.kills))).toFixed(0),
  '| throws', avg(r => r.st.throws).toFixed(0), 'bounce', avg(r => r.st.bounce).toFixed(0),
  '| mined', avg(r => r.st.mined).toFixed(0), 'eaten', avg(r => r.st.eaten).toFixed(0),
  '| grip', avg(r => r.up.grip).toFixed(1), 'rockDmg', avg(r => r.up.rockDmg).toFixed(1));
const med = a => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const late = res.flatMap(r => r.waves.filter(x => x.w >= 10).map(x => x.gold));
const early = res.flatMap(r => r.waves.filter(x => x.w >= 3 && x.w < 10).map(x => x.gold));
console.log('        income/game', avg(r => r.st.mined + r.st.spat).toFixed(0), '(spat', avg(r => r.st.spat).toFixed(0) + ')',
  '| spent', avg(r => r.st.spent).toFixed(0), '| gold@shop median w3-9', med(early), 'w10+', med(late),
  '| bombs', avg(r => r.st.bombs).toFixed(1), '| lv', ['multi', 'magnet', 'vein'].map(k => k + avg(r => r.lv[k] || 0).toFixed(1)).join(' '));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(res));
