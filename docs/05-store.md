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
  - **还没上传**：`start_cover_upload` 要用户点头。

## 2. 文案（英文为主，其他语言跟游戏的 8 种语言）

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
