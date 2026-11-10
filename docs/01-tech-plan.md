# 01 · 技术方案

> 状态：草案。玩法原型在 `prototype/v2.html`，平衡模拟在 `prototype/tools/sim2.js`（运行：`node prototype/tools/sim2.js`）。

## 1. 结论

**以 Potion Siege 的工程为模板**（它的谱系来自 Holy Kicker / `D:\standing`），单包结构，不做 monorepo。

| 项 | 选择 | 来源 |
|---|---|---|
| 渲染 | PixiJS 8（2D） | Potion Siege / Holy Kicker / Blight Bloom |
| 语言 | TypeScript strict | 全部 |
| 构建 | Vite 6，`base: './'` | Potion Siege |
| 测试 | Vitest 4 + playwright-core 冒烟 | Potion Siege |
| 模拟 | 确定性定点（FP=1000），30 Hz 固定步长，自带 PRNG 和三角表 | Potion Siege / Holy Kicker |
| 平衡 | `src/sim/balance.json` + 无头 bot + CI 锁定区间 | Potion Siege `scripts/guard` |
| i18n | `t()`，en.ts 为准，缺 key 编译报错 | Blight Bloom / Potion Siege |
| 存档 | `KeyValueStore` 抽象 + SaveKeeper | Potion Siege |
| 部署 | Cloudflare Workers 静态资源（wrangler） | 全部 |

为什么选 Potion Siege 而不是其他三个：

- **玩法最接近**：竖屏塔防，一端是城墙，敌人从另一端走过来。
- **横竖屏方案已经验证过**：竖屏 1080×1920，宽屏时只把视图转 90°（城墙到左边，敌人换侧面图），模拟、种子、回放都不变。这正是本作"起重机在下方或左方"的需求。
- 单包结构比 Holy Kicker / Blight Bloom 的 workspaces 简单。本作没有服务器和联机，不需要拆包。
- Swarm Orbit 用 Three.js，对 2D 游戏是多余的；Blight Bloom 只支持横屏。

## 2. 目录结构

```
Tidehook/
  src/
    sim/            确定性模拟：不依赖 Pixi 和 DOM，不用 float
      math/         fixed.ts、prng.ts、trig 表
      balance.json  所有数值
      world.ts hook.ts monsters.ts economy.ts shop.ts wave.ts
      events.ts     SimEvent 队列，是模拟通往视图的唯一出口
    view/           Pixi 渲染、动画、特效、HUD
      viewport.ts   fitDesign / textBoost
      orient.ts     逻辑坐标 → 屏幕坐标（竖/横）
      layout/       竖屏和横屏各一套 HUD 和商店布局，外加 check.ts 溢出检查
      kit/          palette.ts 和 UI 组件
    audio/
    i18n/
    save/
    platform/       types.ts + web / crazygames / playgama / stub
    analytics/
    main.ts main.crazygames.ts main.playgama.ts
  scripts/          checkFileLength、guard（平衡）、smoke、build-zip、buildId
  tools/            Python 美术工具（从 Potion Siege 复制）
  art/              prompts/、style/、cut/、web/（源图，不进包）
  public/art/       WebP 成品
  docs/             中文设计文档
  prototype/        v2.html 原型 + sim2.js（只作参考，不进包）
```

## 3. 模拟层（从原型移植）

- 把 v2.html 的逻辑按模块拆进 `src/sim/`，浮点改成定点，`Math.random` 改成种子 PRNG。
- 固定 30 Hz 步进，视图层插值（`fixedStep.ts` 从 Potion Siege 复制）。
- 模拟只输出 `state` 和 `events`（甩钩、抓到、砸碎、吐鱼、爆炸、受击……），视图和音频只读不写。
- `determinismLint` 测试：禁止在 sim 目录用 `Math.random`、`Date`、浮点三角函数。
- **平衡守卫**：把 `sim2.js` 的玩家画像（good / casual / spam / nogold）移植成 TS bot，每次 CI 跑固定种子，用当前原型的结果锁定区间：

  | 画像 | 中位波次 |
  |---|---|
  | good | 约 19 |
  | casual | 约 9 |
  | spam | 约 4 |

  另有一条硬约束：不捞钱的打法必须明显更差。

- **钩尖 7 → 10，怪物每波加速 0.02 → 0.035**（手感修正）。玩家反馈：钩子看着碰到了，却没抓到。原因有三：
  - 贴图比命中圆大，竖屏横向尤其明显，最多多出约 30 个单位。
  - 钩子图向前多画了约 20 个单位。
  - 教程金线对怪用了 bot 的余量 15。

  前两条在视图里修，见 [00-art-direction.md](00-art-direction.md)；金线改用真实半径。钩尖加宽 3 个单位，让擦边也算抓到，但这会让游戏变容易，所以用每波加速抵回来。120 局中位数（good / casual / spam / good 不捞 / casual 不捞）：

  | 方案 | good | casual | spam | good 不捞 | casual 不捞 |
  |---|---|---|---|---|---|
  | 原值（钩尖 7） | 16 | 10 | 4 | 11 | 7 |
  | 钩尖 10 | 18 | 11 | 4 | 13 | 8 |
  | 钩尖 10 + 加速 0.035 | 16 | 10 | 4 | 12 | 7 |

  也试过把补偿放在怪物加血或鱼价成长上，效果都不如加速干净。

- **钩尖 10 → 13，不再抵消**（容错，2026-11-09）。点击时机修好后（§5，SEEN_MS = 0），录下的一局里 47 次有目标的出钩抓到 35 次（74%）。剩下的漏抓分三类：
  - 打到大块头被弹回：这是机制，要先磨血。
  - 前面挡着杂物。
  - 3 次擦边：贴图横向最多画到命中圆的 1.6–2 倍，看着已经叠上了。

  拿这局录像回放不同的加宽量（多抓到的 / 多带出的不想要的擦碰）：+2 → 2 / 1，+3 → 3 / 1，+4 → 3 / 3，+6 → 3 / 4。+3 正好收下这 3 次擦边，再宽就只剩副作用。没有选缩小贴图：贴图大小是美术定的可读性，而且缩了也只是让玩家更早看出没碰到，抓不到的还是抓不到。

  守卫 40 局中位数（good / casual / spam / good 不捞 / casual 不捞）：

  | 方案 | good | casual | spam | good 不捞 | casual 不捞 |
  |---|---|---|---|---|---|
  | 钩尖 10，加速 0.035 | 16 | 10 | 4 | 12 | 7 |
  | 钩尖 13，加速 0.035（采用） | 18 | 11 | 4 | 12 | 7 |
  | 钩尖 13，加速 0.04 | 17 | 11 | 4 | 12 | 7 |
  | 钩尖 13，加速 0.045 | 16 | 11 | 4 | 11 | 8 |

  加速压不下 casual，只压 good，所以不抵消：容错就是要让游戏好打一点，各项都还在带内。casual 中位数 11 正好在上限，以后哪次改动让它变成 12，就该收紧别的东西（比如怪物血量成长），不要把钩尖收回去。

- **扔杂物：瞄准线画到落点**（2026-11-09）。试玩反馈"一次都没扔到"。录像里 7 次投掷其实中了 4 次，但都打在 600–750 远处，正好在提示横幅底下，命中只有一个小奶油圈，所以没看见。没中的 3 次分别差 7.6 / 9.8 / 23.8。远处的目标只有 ±2.5° 的余量（约 ±26 ms），可瞄准线只有 260 长，玩家得靠眼睛把它延长到 700 外。改了这些：
  - 手里有杂物时，瞄准线就是投掷准星（`src/view/scene/sight.ts`）。它用投掷半径 15 沿射线走，画到第一只会被打中的怪，并给那只怪套上红圈；前面没有怪就画到出界。测试钉住了一条：准星标出某只怪，当且仅当现在扔一定能打中它。
  - 投掷命中（`hit` 事件带上 `thrown`，水雷炸到的也算）改成宽的黄铜圈，并从怪身上升起"−3"。
  - 提示横幅：竖屏高度 170 → 130，底色不透明度 0.85 → 0.7，停留时间 5 → 4 秒，少挡远处的怪。
  - 投掷半径没加大。试过 20，casual 中位数到 12，出了带。bot 本来就沿射线瞄准，所以准星只帮玩家，平衡不动，守卫中位数不变（18 / 11 / 4 / 12 / 7）。
- **投掷：准星压住怪时摆动放慢**（2026-11-09）。试玩反馈"瞄准的时间不足一秒，等我反应过来已经错过了"。录像里 6 次投掷中了 4 次，没中的两次都是远处的 grunt，余量只有 ±2.4–3.6°。摆动中段角速度约 97°/s，一个 tick 就扫过 3.7°，比远处的怪还宽，准星在它身上只停 1 个 tick（33 ms）。改了这些：
  - 手里有杂物时，摆动按 `throw.aimSlow`（0.15）倍的小步走，哪一步让射线（投掷半径）压到怪就停在那一步。所以减速从目标边缘开始，不会被一大步跨过去（`src/sim/hook.ts` 的 `swing`）。700 远的 grunt 被压住的时间从 1 个 tick 变成 9 个（约 300 ms），近的更久。
  - `hook.rate` 记下上一个 tick 实际走了多少相位。点击回看（`Session.lookBack`）和 `fire` 的回看上限都按它算，不再用满速。
  - bot 一压到就扔，所以守卫基本不动：18 / 11 / 4 / 12 / 8（casual-nofish 7 → 8，仍在带内）。
  - 测试：`src/sim/aimSlow.test.ts`。
- **出钩：准星压住物品时也稍微放慢**（2026-11-09）。下一局录像：12 次投掷全中，出钩干净命中 79%（上一局 73%），打到第 7 波。试玩反馈"扔东西的手感很好"，希望能抓到东西时也慢一点，但降幅比扔小。
  - 空钩时用同一套小步走法，倍数是 `hook.aimSlow`（0.7，即慢 30%；扔是慢 85%）。只在射线（钩尖半径）先碰到鱼、宝箱或杂物时减速，碰到怪不减速（`hook.ts` 的 `onTarget`）。
  - 先试过碰到抓得动的怪也减速：0.5 和 0.7 都让 casual 中位数到 13，出了带。原因是 casual bot 每 9 个 tick 才看一眼，慢摆让它看见的目标多了很多，等于把防守变简单了。想靠难度补回来也不行：加怪的速度，good 掉得比 casual 还多；加每波血量（0.15）能把 casual 压回 11，但 grunt 早一波就超过初始抓力，被弹回的次数会变多。所以减速只给物品。
  - 只减速物品也会帮到 casual（平均波数 11.3 → 11.8），它本来就贴在带顶。0.6 时中位数到 12，0.7 和 0.8 是 11，选了 0.7。守卫 19 / 11 / 4 / 12 / 8。
- **投掷准星给走动的怪留提前量**（2026-11-09）。下一局录像：出钩干净命中 81%，投掷 10 中 7，打到第 6 波。没中的 3 次里：
  - 两次是贴边的 grunt（w 53 和 w 440），身边 59、78 远处有鱼。诱饵范围 110 以内，它正横着走去吃鱼。垃圾飞到那里要 0.6–0.75 秒，按发射点看它横移了约 2.9°，比命中半角（约 2.7°）还大。准星和减速当时都按"怪站着不动"算，所以标红了，打出去却擦过。
  - 一次准星上根本没有怪（显示 15.7°，最近的怪在 4.3°），像是误点或看错，不算手感问题。
  - 做法：新模块 `sim/lead.ts` 的 `throwFirst` 完全按垃圾自己的走法往外推（每 tick 走 `speed`，按 `step` 分小步，`throw.ts` 同款），每一小步都拿怪在那个 tick 的位置来判碰撞。怪的位置是在副本上提前演算出来的，用的是 `monsters.ts` 同一套 `heading`（去吃鱼还是去起重机，够近就停下吃）和 `walk`（含游泳怪的左右摆），晕眩倒计时和平静期的停步也算进去。顺序和 `step.ts` 一样：点按在两 tick 之间生效，每 tick 垃圾先动、怪后动，所以怪的第 k 步发生在 `w.tick + 1 + k`。只演算到射线用得到的 tick 为止。
  - 第一版只按上一 tick 的位移直线外推（游泳怪不含摆动），下一局录像（2026-11-09，第 7 波，出钩干净命中 83%）投掷 13 中 12，唯一没中的是 darter：飞行中摆动偏了 2.7°，直线外推算不到，于是改成上面的逐 tick 演算。另外第一版沿线按均匀 8 的步长采样，而垃圾每 tick 走 26.667，最后一小步只有 2.667，两边采样点会错开，擦边的角度会判反；现在和垃圾走同一组点。
  - 准星（`sight.ts`）、投掷减速（`hook.ts` 的 `onTarget`）、教学的金线（`aimFinds`）和 bot 的投掷判断都改用它。准星线停在垃圾会碰上怪的地方，略在怪前方；红圈仍画在怪身上。`lead.test.ts` 用 sim 自己的 `step` 真的扔出去，对两种场景扫角度：被鱼引着横走的 grunt 和左右摆的 darter，提前量的判断和实际结果逐个角度一致；旧的"站着不动"判断在 grunt 上错的比真正能打中的一半还多。
  - 投得更准让 casual 中位数到 12–13，出了带，good 几乎不变。补偿用每波出怪间隔的缩短 0.11 → 0.14 秒：密度对每 9 tick 才看一眼的 casual 影响更大。40 个种子的中位数噪声有一波左右，所以另用 160 个种子量平均值：0.12 时 good 16.68 / casual 11.56，0.14 时 16.61 / 11.07，确实只压 casual。第 7 波的出怪间隔从 2.23 秒变成 2.02 秒。守卫 17 / 11 / 4 / 12 / 8。

## 4. 横竖屏布局

**逻辑空间**：一条"航道"，坐标为距离 d × 宽度 w。原型是 800×480，正式版改为 1920×1080 的设计单位，d 轴是长边。

```
竖屏 (h > w)                  横屏 (w ≥ 1.1·h)
┌────────────┐               ┌──┬──────────────────┐
│  HUD 顶栏   │               │码│                  │
│   远洋      │               │头│ 浅滩 → 中海 → 远洋 │
│   中海      │               │吊│  怪从右往左爬      │
│   浅滩      │               │钩│                  │
│ ══码头吊钩══ │               ├──┴──────────────────┤
│ 商店/按钮条  │               │ HUD / 商店侧栏（右）  │
└────────────┘               └─────────────────────┘
```

- `orient.ts` 只做一件事：逻辑 (d, w) → 屏幕 (x, y)。竖屏 `x=w, y=H-d`，横屏 `x=d, y=w`。点击坐标做逆变换。
- 怪和鱼的贴图按方向选正面或侧面版本，见 [00-art-direction.md](00-art-direction.md)。
- HUD 和商店不旋转。竖屏放在下方（码头下面），横屏放在右侧边栏。这一点借鉴 Swarm Orbit"控制条贴一条边，其余全给战场"的规则。
- 适配：`fitDesign` 等比放进屏幕，不足的一边用海水或码头背景延伸填充，不留黑边。`textBoost` 在 800×450 这类小嵌入尺寸下放大文字。
- 安全区：平台层提供 safe-area insets，HUD 避开。
- 验证：Playwright 跑 `sweep:layout`，尺寸为 390×844、844×390、768×1024、1280×720、800×450，加上 `layout/check.ts` 溢出检查，进 CI。

## 5. 输入

- **出钩角度按玩家看到的算。** 钩子一直在摆，中段转速约 112°/s（升级摆幅后更快）。玩家点下去时看到的那一帧，比模拟当前的角度早了一截：
  - 视图在两个 tick 之间插值，画面比模拟慢 0–1 个 tick（0–33 ms）；
  - 浏览器把一帧画到屏幕上约 2 帧；
  - 触屏上报手指还要几十毫秒。

  加起来约 0.1 s，出钩方向在摆动方向上偏出去约 10°，绳长 300 时横向差 50 多个单位，比一条鱼还宽。人对匀速晃动的东西本来就会往前预判一点（flash-lag 效应），能抵掉一部分，但抵不完，所以感觉“扔出去的和预判的不一样”。

  做法：点击时模拟把摆动相位往回倒，用那时的角度出钩（`fire(w, back)`，最多倒 5 个 tick）。倒多少 = 插值落后的那部分 tick + `SEEN_MS` + 事件排队的时间（事件时间戳，最多 100 ms）。扔杂物同样用这个角度，但不改摆动，所以摆动不会跳。bot 和测试不倒（不传 `lagMs`），平衡守卫不变。开发版可以用 `?lag=毫秒` 调 `SEEN_MS`（0–150），找到手感最准的值再写死。

  实测（2026-11-09，点击记录器，桌面鼠标，49 次点击）：`SEEN_MS` 起初定 50 ms，结果落空的点击里 27 次偏早、2 次偏晚，出钩平均比画面上的瞄准线落后 5.5°；而玩家对准的目标离画面瞄准线的中位偏差只有 0.2°，也就是人眼的预判正好抵掉了屏幕延迟。按画面瞄准线出钩重算这 43 次有明确目标的点击，能中 39 次，而 50 ms 时实际只中 21 次。所以 `SEEN_MS` 改为 0，只保留插值和事件排队两部分。手机触屏延迟更大，上手机后再录一次核对。
- 点击记录器（开发版默认开着，`?rec=0` 关掉；`src/game/rec/`）：用来对着真人的点击调手感。每次点击记一条：屏幕上画出来的瞄准角度、模拟里的角度、实际出钩角度、回倒了多少、摆动方向，以及当时画面上每个目标的位置、半径和相对吊点的方位；钩子收回时再补上结果：抓到了谁、有没有被弹开、每个目标离钩子最近时差多少（按这一帧扫过的线段算，不是只看帧末）。没出钩的点击（钩子在外面）也记，带钩子状态。记录发给 dev server，由 `scripts/rec/sink.mjs` 追加到 `recordings/rec-日期.ndjson`（已 gitignore，Vite 不监视）。分析：`node scripts/rec/analyze.mjs [文件] [--all]`，按“画出来的瞄准线离谁最近”推断每次点击想钩的目标，列出目标相对画面瞄准线的偏差（seen°）、相对实际出钩的偏差（cast°）、飞行中目标自己挪了多少（drift°）和最近距离。读法：落空时 cast° 普遍为正（目标在摆动前方）说明回倒多了，应调小 `SEEN_MS`；普遍为负说明回倒少了；seen° 普遍不为零说明是人的预判习惯，不是延迟。手机上用 `http://电脑IP:5190/` 打开（dev server 开了 `host`）。
- 单键或单点：点任意处（或空格）甩钩。v2 的键位作为桌面快捷键保留：1/2/3 选卡、4 修理、5 水雷、R 刷新、Enter 开始。M 开关声音。
- 不用 Esc 做暂停，因为门户 iframe 会吞掉 Esc（Swarm Orbit 的教训）。暂停按钮从第一帧起就画出来。
- iframe 尺寸为 0 时不初始化，等 resize（Swarm Orbit 的教训）。

## 6. 平台与变现

- `Platform` 接口统一管理：广告、存储、静音和暂停、gameplay start/stop、庆祝、遥测。每个目标一个入口文件和一个 vite 配置。
- **首发只做 Playgama**（2026-11 决定；CrazyGames 不做）。自有网页（`main.ts`）留作开发和试玩用。
  - 入口 `src/main.playgama.ts`，实现在 `src/platform/playgama/`，配置 `vite.playgama.config.js`：把 Bridge v2 的 CDN 脚本插到 `</title>` 后，作为 head 里第一个脚本，并输出 `playgama-bridge-config.json`（`minimumDelayBetweenInterstitial: 60`）。构建时如果 HTML 没被改写就直接报错。
  - 命令：`npm run dev:playgama`（端口 5191，`.claude/launch.json` 的 "playgama"，Bridge 跑 mock 平台）；`npm run build:playgama` 输出 `dist-playgama/` 并打成 `tidehook-playgama.zip`（`scripts/pack_playgama.py`）。`npm run check` 最后也会跑一遍。
  - 存档只走 Bridge storage（语言、声音、教程、港口四个 key）。
  - 上传和发布沙盒都要先问过人。
- **激励广告**（`src/game/ads.ts`），每局各一次，都由玩家自己点：
  - **修好码头**：码头被毁后，结算先挂起（`Session.pending`），卡片上只有“修好码头”和“算了”。看完广告后，码头回到一半血，离码头 300 内的怪被推回 300，所有怪晕 2 秒（`sim/revive.ts`），这一波接着打。点“算了”或者没有广告可放时，才正式结算。广告开始了但没看完，按钮保留。
  - **珍珠 ×2**：结算后，本局珍珠大于 0 时出现在卡片上。
  - **免费换牌**：商店的换牌按钮变绿，看广告免费换一次，不花金币，也不涨换牌价。
  - 平台说没有激励广告时（比如检测到广告拦截，或在 mock 平台上），三个按钮都不出现。autoplay 局和没有港口的局也不出现。
- **插屏广告**只放在自然断点：一波打完、商店打开时，以及从结算回港口时。新玩家的第一局不放；看过激励广告后，到下一波开始之前也不放。频率交给 Bridge 的 `minimumDelayBetweenInterstitial`，游戏里不另外计时。
- 广告播放期间 `Session.hold` 冻结模拟、吞掉点击，声音静音。
- **遥测**（`src/game/telemetry.ts`，按 Playgama telemetry guide v1.1.2）：
  - `progression_started` / `_completed` / `_failed`：step_id 为 `wave`，带 step_index 和 sea；
  - `tutorial_step` / `tutorial_completed`；
  - 每 30 秒有效游玩发一次 `performance_sample`（`src/game/perf.ts`）；
  - 出现新纪录或完成船长日志目标时调用 `celebrate()`（`player_got_achievement`）。
  - 不发任何玩家个人信息。
- **之后再说**：iOS（Capacitor 8 + AdMob + 去广告内购 + Game Center + Capgo OTA，照 Potion Siege 的 `docs/ios.md`），以及微信小游戏（竖屏天然适配，参考 Blight Bloom 的 Pixi DOMAdapter 方案，主包 4 MB）。
- 包体：首包 ≤ 5 MB，图片用 WebP。目前 `dist-playgama` 2.13 MB，zip 1.5 MB。

## 7. 后端

- **v1 不做服务器**。存档在本地，使用平台存储。
- 需要排行榜或遥测时，复用 Potion Siege 的 collector（Node + NDJSON，Hetzner + cloudflared），模拟是确定性的，可以用回放校验分数。

## 8. 工程规范（沿用）

- 代码、注释、commit、README 用英文；`docs/` 设计文档用中文。
- 单文件 ≤ 500 行（含测试），由 `scripts/checkFileLength.mjs` 强制。
- `npm run check` = typecheck + 文件长度 + 单测 + 平衡守卫 + 构建 + 包体大小（≤ 5 MB）。
- 不写字面量文案，全部走 `t()`；所有数值进 `balance.json`。
- 开发开关：`?autoplay`、`?speed`、`?ads=fake`、`?lang`、`?seed`、`?lag`、`?rec=0`（关掉点击记录器）。
- `.claude/launch.json` 为每个构建变体配一个预览服务。

## 9. 里程碑建议

1. **M0 脚手架**（完成）：从 Potion Siege 复制 vite、tsconfig、check 脚本、platform/stub、i18n、fixedStep，空场景跑通。
2. **M1 模拟移植**（完成）：sim 定点化，bot 在 CI 中复现原型的波次分布。
3. **M2 灰盒视图**（完成）：色块和描边，横竖屏布局与 sweep 通过。
4. **M3 Style frame**（完成）：r2 定稿，19 张精灵（`public/art/`，约 150 kB）和 21 个音效 cue + 1 段音乐（`public/audio/`，约 1.1 MB）接进游戏，HUD 加声音开关。管线见 `00-art-direction.md` 第 6、7 节。包体 1.9 MB。
5. **M4 平台接入**（代码完成，未提交，未上传）：只做 Playgama，包括 Bridge 存档、激励和插屏广告、遥测，见第 6 节。
6. **M5 上线**：网页 → 门户提审。

## 10. 待你确认

1. ~~首发平台~~：已定，只做 Playgama。
2. v1 是否完全不要服务器（排行榜放到后面）？
3. 正式版是否要关卡制，还是只做无尽波次？现在原型是无尽模式。
