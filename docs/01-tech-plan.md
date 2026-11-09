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

- 单键或单点：点任意处（或空格）甩钩。v2 的键位作为桌面快捷键保留：1/2/3 选卡、4 修理、5 水雷、R 刷新、Enter 开始。M 开关声音。
- 不用 Esc 做暂停，因为门户 iframe 会吞掉 Esc（Swarm Orbit 的教训）。暂停按钮从第一帧起就画出来。
- iframe 尺寸为 0 时不初始化，等 resize（Swarm Orbit 的教训）。

## 6. 平台与变现

- `Platform` 接口统一管理：广告、存储、静音和暂停、gameplay start/stop、商店。每个目标一个入口文件和一个 vite 配置。
- **首发**：自有网页（Cloudflare，域名建议 `t.gamestao.com`）+ CrazyGames SDK v3 + Playgama Bridge v2。
- **激励广告**：码头被毁后复活一次；结算收益 ×2；商店免费刷新一次。检测到广告拦截时隐藏激励按钮。
- **插屏广告**：波次之间，按 `adPacing` 控制频率。
- **之后再说**：iOS（Capacitor 8 + AdMob + 去广告内购 + Game Center + Capgo OTA，照 Potion Siege 的 `docs/ios.md`），以及微信小游戏（竖屏天然适配，参考 Blight Bloom 的 Pixi DOMAdapter 方案，主包 4 MB）。
- 包体：首包 ≤ 5 MB，图片用 WebP。门户上传前先测子路径部署。

## 7. 后端

- **v1 不做服务器**。存档在本地，使用平台存储。
- 需要排行榜或遥测时，复用 Potion Siege 的 collector（Node + NDJSON，Hetzner + cloudflared），模拟是确定性的，可以用回放校验分数。

## 8. 工程规范（沿用）

- 代码、注释、commit、README 用英文；`docs/` 设计文档用中文。
- 单文件 ≤ 500 行（含测试），由 `scripts/checkFileLength.mjs` 强制。
- `npm run check` = typecheck + 文件长度 + 单测 + 平衡守卫 + 构建 + 包体大小（≤ 5 MB）。
- 不写字面量文案，全部走 `t()`；所有数值进 `balance.json`。
- 开发开关：`?autoplay`、`?speed`、`?ads=fake`、`?lang`、`?seed`。
- `.claude/launch.json` 为每个构建变体配一个预览服务。

## 9. 里程碑建议

1. **M0 脚手架**（完成）：从 Potion Siege 复制 vite、tsconfig、check 脚本、platform/stub、i18n、fixedStep，空场景跑通。
2. **M1 模拟移植**（完成）：sim 定点化，bot 在 CI 中复现原型的波次分布。
3. **M2 灰盒视图**（完成）：色块和描边，横竖屏布局与 sweep 通过。
4. **M3 Style frame**（完成）：r2 定稿，19 张精灵（`public/art/`，约 190 kB）和 21 个音效 cue + 1 段音乐（`public/audio/`，约 1.1 MB）接进游戏，HUD 加声音开关。管线见 `00-art-direction.md` 第 6、7 节。包体 1.9 MB。
5. **M4 平台接入**：CrazyGames 和 Playgama、广告、存档、分析。
6. **M5 上线**：网页 → 门户提审。

## 10. 待你确认

1. 首发平台：CrazyGames + Playgama + 自有网页，还是也要微信？
2. v1 是否完全不要服务器（排行榜放到后面）？
3. 正式版是否要关卡制，还是只做无尽波次？现在原型是无尽模式。
