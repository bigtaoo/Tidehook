# 05 · 商店页：封面和文案

> 2026-11-10 写。上传、填表都要用户点头（CLAUDE.md），这里只备好材料。

## 1. 封面

Playgama 表单三个封面位，尺寸固定：方形 800×800、竖版 1080×1920、横版 1920×1080（PNG 或 JPEG，≤ 10 MB）。

- 原画：`art/raw/cover/`，prompt 在 `art/prompts/cover_edit*.txt`。从 style frame r14（`art/style/style_frame_r14_mix_land.png`）编辑出来，保持“古海图 + 剪纸”的混合画风：
  老船长在码头摇绞盘，钩住一条跃出水面的钢蓝鲨鱼，周围几条暖色鱼和一只宝箱。上面三分之一留空给标题。
- 合成：`python tools/build_cover.py`。按三种尺寸裁切原画，标题“Tidehook”用游戏里的 Logo 字体画在留白处，写进 `art/cover/cover_{square,portrait,landscape}.png`。
- 画面规则照美术方向：怪是冷色（第一版生成出一只红螃蟹，第二次编辑改成钢蓝灰），鱼是暖色，没有牙齿、没有文字。
- 实际出图（2026-11-10）：字体是本机的 Segoe UI Black（Logo 字体 Luckiest Guy 不在这台机器上），奶油色字、深胡桃色描边加一层柔影。
  - 方形和竖版比原画高，上面补的天空是原画最上面 20% 的几行镜像接上去的（只取鲨鱼水花上方那几行，不然会镜像出水花的残影）。
  - 横版裁出来鲨鱼在上面，标题放到左上那片空海里（中心在 34% 宽处，最宽 38%），不压鲨鱼。
  - 大小：方形 662 kB、竖版 1.5 MB、横版 1.9 MB，都在 10 MB 以内。
  - **已上传**（2026-11-16）：三个封面位都占上了，`get_launch_steps` 的 covers 这步是 DONE。

## 2. 游戏截图（2026-11-16）

六张，`art/store/`，都是真实画面，不是拼的：

| 文件 | 尺寸 | 画的是 |
| --- | --- | --- |
| `land_play.png` | 2560×1440 | 横屏第 6 波：钩子在甩，螃蟹、鱼、木头和酒桶都在道上 |
| `land_shop.png` | 2560×1440 | 横屏波间商店：三张升级牌加三个常驻按钮 |
| `land_harbour.png` | 2560×1440 | 横屏港口：七张永久升级和七个页签 |
| `port_play.png` | 1440×2560 | 竖屏第 6 波，同一局 |
| `port_shop.png` | 1440×2560 | 竖屏波间商店 |
| `port_harbour.png` | 1440×2560 | 竖屏港口 |

怎么出的（要重出照这个来）：

1. `npm run dev`，浏览器开 `?autoplay=good&speed=3&seed=7`，机器人自己打。
2. 预览窗口被挡住时 rAF 会被节流，光等是等不到第 6 波的：在控制台里**手动推帧**
   （`app.ticker.update(t)` 每次 +16.7 ms），推到想要的局面再停。
3. `app.render()` 之后 `app.canvas.toDataURL('image/png')`，POST 给开发服务器的 `/__shot?name=…`
   （`scripts/shot/sink.mjs`，只在 dev 挂着），落到 `art/store/`。
4. 商店和港口那几张要去掉机器人：`session.pilot = null` 再推一帧，标题就从"The bot is browsing"回到正常文案。
   港口那张还要 `session.mode = 'lobby'`、给几颗珍珠（`session.harbour.pearls = 46`），不然卡片全是灰的。
5. 分辨率：`app.renderer.resize(1280, 720, 2)` 出 2560×1440，竖屏同理。

**还没上传**：截图只能人在后台传，没有工具（MCP 的说明里写死了）。沙盒不需要截图，提审才要。

## 3. 文案（英文为主，其他语言跟游戏的 8 种语言）

**名字**：Tidehook

**一句话**（短描述，≤ 80 字符）：
- en: Hook fish for gold, hurl junk at sea monsters, and hold the dock.
- zh: 钩鱼换金币，甩破烂砸海怪，守住码头。
- de: Angle Fische für Gold, wirf Schrott auf Seeungeheuer und halte den Steg.
- es: Pesca peces por oro, lanza chatarra a los monstruos y defiende el muelle.
- fr: Pêche des poissons, lance des débris sur les monstres et tiens le quai.
- pt: Fisgue peixes por ouro, atire sucata nos monstros e defenda o cais.
- ru: Лови рыбу ради золота, кидай хлам в чудищ и удержи причал.
- tr: Altın için balık tut, canavarlara hurda fırlat, iskeleyi koru.

**长描述**（en）：

> You run the winch at the end of an old wooden dock. Tap to cast the hook: haul in fish and treasure chests for coins, the farther out the richer. But the sea is waking up. Crabs, eels, turtles and hungry sharks are climbing toward your planks, wave after wave.
>
> Hook a monster and slam it onto the dock, or grab a log or an anchor and fling it back at them. Spend your coins between waves on a stronger grip, a faster winch, sea mines and chain hooks. When the dock breaks, the pearls you earned buy lasting upgrades in the harbour, and new seas to sail: the Fog Bank, where you cannot see what is coming, and the Storm Reach, where the wind bends every cast.
>
> - One-tap controls, portrait or landscape
> - Six kinds of sea monster, from hermit crabs to diving rays, and two bosses
> - A daily voyage: the same sea and seed for everyone, once a day
> - Hand-cut paper art on an antique sea chart

**玩法说明**（How to play，en）：
Tap to cast the swinging hook. Fish and chests become coins when they reach the dock; monsters hooked onto the dock are smashed. With junk on the hook, tap again to throw it at the monster in your aim. Buy upgrades between waves. Don't let the monsters break the dock.

**分类和标签**：类型 Casual / Arcade；标签 fishing, tower defense, one tap, upgrade, sea monsters, pirates（以 `get_game_categories` 实际给的为准）。

**中文长描述**（zh，给中文表单位）：

> 你守着老码头尽头的绞盘。点一下甩钩：把鱼和宝箱拉上来换钱，甩得越远越值钱。可是海醒了，螃蟹、海鳗、海龟和贪吃的鲨鱼一波接一波往码头爬。
> 钩住海怪砸在码头上，或者捞根木头、一只锚甩回去砸它们。每波之间用金币买更紧的抓力、更快的绞盘、水雷和串钩。码头撑不住时，攒下的珍珠能在港口买永久升级，还能去新的海：雾湾里看不见远处来的是什么，风暴海的风会把每一钩吹偏。

## 4. 已发布的沙盒（2026-11-16）

- 游戏 id `cmwj0uz1l2q3plk0hdnr1ppb9`，包 `tidehook-2026-11-16c`（`cmwj3u6p64ez1lz0hchada7g8`，Bridge 2.4.2，build check PASSED）。
- 沙盒链接：<https://playgama.ai/play/l4lyg34afht6w2>（任何拿到链接的人都能玩，没过审核）。
- 表单填的：category `arcade`（核心玩法是一键的时机判断，不是摆塔；`get_game_categories` 的规则是"玩家大部分时间在干什么"），
  engine `js`，8 种语言（EN ZH DE ES FR PT_BR RU TR），三种设备，横竖屏都支持，leaderboards 开，multiplayer/social 关。
  `distributeEverywhere` 没动（还是空）——那是把游戏分发到合作平台的授权，等用户自己定。
- 内购目录：一个 `remove_ads`，non_consumable，$1.99。
- 还没做的：商店截图（人工）、提审（人工）、`start_sandbox_traffic`（要花流量奖励，要用户点头）。
