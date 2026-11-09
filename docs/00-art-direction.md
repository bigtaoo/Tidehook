# 00 · 美术方向

> 状态：草案，待定稿。定稿条件是一张通过的 style frame（见第 6 节）。

## 1. 题材一句话

**《拉钩港》Tidehook**：守在码头尽头的吊钩起重机。往海里甩钩，捞鱼、捞宝藏换钱，也能把爬上岸的海怪拽上来砸碎。
离岸越远，鱼越值钱。海怪越来越凶，码头撑不住就输。

| 原型（v2.html） | 题材 | 说明 |
|---|---|---|
| 钻机 | 码头吊钩起重机 | 玩家本体，固定在近岸端 |
| 金块（小/大） | 鱼 / 宝箱 | 数字 = 重量；离岸越远越值钱 |
| 石头 | 浮木 / 锚 / 破桶 | 甩回去能砸怪 |
| 普通怪 | 螃蟹兵、海胆、章鱼、鮟鱇等 | 从海里往码头爬 |
| 贪吃怪 | 贪吃鲨 | 吃鱼变重；拽上岸被砸死时把吃的鱼吐出来 |
| 炸弹 | 水雷 | 钩到太重的怪时自动引爆 |
| 修理 | 补木板 | 修码头血量 |
| 深矿（vein） | 远洋渔场 | 远处刷出更多更贵的鱼 |
| 串钩 / 磁钩 | 串钩 / 磁铁钩 | 名字不变 |

## 2. 画风：贴纸卡通（沿用 Holy Kicker / Potion Siege）

直接沿用前两个项目已经跑通的风格前缀，不重新探索：

- 粗而均匀的黑色描边，平涂色块，每种颜色只配一档硬朗的 cel 阴影
- 不用渐变、高光、材质纹理，也不做"3D 渲染感"
- 角色约 2 头身（chibi），每只怪都要有**一个独有的剪影特征**（钳子、背鳍、触手、灯笼）
- 判断标准是手机尺寸下看得清，不是大图好看

理由：

1. 两个项目的 Mistral 生图 → `flatten` → `bake_mob` 管线已经验证过，风格前缀拿来就能用。
2. 本作画面元素小且多（海里同时有十几条鱼和怪），粗描边加平涂在小尺寸下最好认。
3. 水体是大面积背景，平涂分层（浅海→深海）既便宜又能直接表达"越远越值钱"。

## 3. 颜色规则

颜色本身就是玩法信息，按角色分配，不允许串用：

| 角色 | 色系 | 例子 |
|---|---|---|
| 玩家 / 码头 / UI | 暖：胡桃木、黄铜、麻绳、奶油纸 | 起重机、码头木板、商店面板 |
| 可捞的收益 | 暖亮：金、橙、珊瑚红 | 金鱼、橙色大鱼、宝箱 |
| 海怪 | 冷：青灰、钢蓝、紫，统一**红眼** | 螃蟹兵、海鳗、海龟、贪吃鲨 |
| 杂物 / 石头 | 中性：褐、灰 | 浮木、锚、破桶 |
| 海水背景 | 冷、降饱和，按距离分层 | 浅滩青绿 → 中海蓝 → 远洋深靛 |
| 危险 / 特效 | 高饱和、少量 | 水雷红、爆炸黄、伤害数字 |

硬规则：

- **怪身上不出现暖色**（红眼除外）。这样暖色就等于"能捞的钱"，一眼可分。这条是 Holy Kicker 和 Potion Siege 的共同教训。
- 鱼可以是海洋生物，但必须暖亮、圆润、表情呆萌；怪必须冷色、有棱角、有敌意。两者剪影要明显不同。
- 海水按离岸距离分 3~4 档明度，作为"价值刻度"。档位边界和 `goldVal` 的距离系数对齐。
- 颜色不能是唯一线索：重量数字始终显示，水雷带图标。
- 海水三档取自 style frame r2（`src/view/kit/palette.ts` 的 `SEA`）：浅滩 `#26B2B0`、中海 `#186E8C`、远洋 `#16284A`。
  螃蟹和海鳗生成出来和中海同色，已用 `recolor.py` 移开：螃蟹改长春花蓝，海鳗改紫。

## 4. 横竖屏构图

只有一套逻辑坐标：**距离（离岸深度）× 宽度**。渲染时按屏幕方向旋转 90°。

- **竖屏**：码头在**屏幕下方**，海往上延伸，怪从上往下爬。
- **横屏**：码头在**屏幕左侧**，海往右延伸，怪从右往左爬。
- 怪和鱼需要两套朝向的图：竖屏用正面/背面，横屏用侧面。做法是先出正面定稿，再用"Redraw the SAME…"编辑出侧面（Potion Siege 的 `enemy_*_side` 做法）。
- 背景分层（码头、浅滩、中海、远洋）做成可平铺的条带，两个方向共用，不画整张背景图。
- 文字和 HUD 不旋转，按方向单独排版（见 [01-tech-plan.md](01-tech-plan.md) 的布局一节）。

## 5. UI 风格

- 用 Pixi Graphics 代码画：圆角面板、粗边、底部"唇边"。调色板沿用 Potion Siege 的胡桃木、黄铜、奶油纸（`view/kit/palette.ts`）。码头题材本身就是木头和黄铜，正好合适。
- 图标走 AI 生成后打成图集（`pack_icons.py`），**不用 emoji**。
- 字体：正文用系统字体，字重 800，加深色描边；Logo 用 Luckiest Guy（OFL）。正文最小 48 设计单位（基于 1080 宽）。
- 文案长度预留约 30%，给德语、俄语等翻译用。

## 6. 美术生产流程

全部沿用 Potion Siege 的 `tools/` 和 prompt 管理方式：

1. **Style frame 先行**：先出一张"实机感"的整屏图，包含起重机、几档海水、3 条鱼、2 只怪、HUD。用户点头后，才开始批量出图。
   生图工具只出 4:3 横图（1024×768 或 1184×880），所以 style frame 按横屏布局画（码头在左，侧栏在右）。prompt 在 `art/prompts/style_frame_gen*.txt`，产物在 `art/style/style_frame_r*.png`。
2. 生图：Mistral agent `image_generation`（`generate_image.sh` / `edit_image.sh` + key 轮换）。
3. 每张图的 prompt 存成 `art/prompts/<name>_gen.txt` 或 `<name>_editN.txt`，和产物同名。
4. 风格锚定：一张通过的样图用文生图，其余全部用"编辑样图"生成，避免风格漂移。
5. 一张图只画一个主体，白底，A-pose 或正视。
6. 后处理（M3 实际管线，`bash tools/build_sprites.sh` 一键重建）：
   - `art/raw/` 存生成器原图（不进包）。脚本里每行写明一个精灵用哪张原图。
   - `flatten.py` 抠图、量化颜色、重描统一描边；`clean_edges.py` 清掉描边旁的杂色点；`recolor.py` 按色相带改色（确定性，正面和侧面改得一样）。产物在 `art/cut/`。
   - `export_web.py` 缩到游戏里最清晰时的尺寸（怪和渔获长边 192 px，够 DPR 3），写进 `art/web/`，同时写 `src/view/artFit.json`（每张图的尺寸和不透明面积折算的半径）。
   - `to_webp.py` 转 WebP q85（alpha 无损）进 `public/art/`，19 张共约 190 kB。
   - 怪的走路不用 `bake_mob.py` 烘帧：`src/view/scene/look.ts` 按走过的距离做起伏和摆动，被眩晕时自然停下。
   - 竖屏怪用正面图（朝下走），横屏用侧面图（朝左走）。
7. **检查**：
   - 每张图都测 alpha，生成器会伪造透明（画出来的棋盘格、半透明残影），这是 Blight Bloom 的教训。
   - 每批图用 `lineup_test.py` 在手机尺寸下并排看。
   - 体型按不透明面积比，不按高度比：视图按 `artFit.json` 把不透明面积缩成命中半径 × 1.5 的圆（`LOOK_SCALE`）。
   - 横跨航道的那一边不超过命中半径 × 2（`ACROSS_MAX`，`look.ts` 的 `lookRadius`）。否则宽图（竖屏的正面乌龟、横躺的原木）看上去碰到了钩子，实际却抓不到。目前只有这两张图被缩小，约缩到原来的 77%。
   - 钩子图的“嘴”（J 形内侧，图高 72% 处）对准模拟里的钩尖，绳子接在顶部的环上（13% 处）。以前环对准钩尖，钩身比判定点向前多伸约 20 个世界单位，钩子看着已经碰到东西，实际还没到。

## 7. 音频

- 全部是本地已有的 CC0 素材：Kenney 的 Impact / Interface / Sci-fi Sounds 和 Music Jingles，音乐用 FreePD 的 Busybody（Bryan Teoh）。不用代码合成音效：Swarm Orbit 记录了 Playgama 审核条款 3.3.2 的风险，Potion Siege 的合成方案不照搬。
- `python tools/build_audio.py` 一键重建：源文件先复制进 `art/audio/sources/`（之后只靠本仓库就能重建），再用 ffmpeg 去头尾静音、限长、转单声道、按 cue 归一峰值，编码成 MP3（各浏览器都能解）写进 `public/audio/<cue>_<n>.mp3`。
  - 音乐做响度归一（-20 LUFS）、保留立体声、96 kbps，去掉头尾静音，避免循环接缝处断一下。
  - 同时写 `art/audio/credits.json`（每个文件的来源和授权）、`src/audio/cues.json`（每个 cue 的变体数）和授权原文 `art/audio/licenses/`。
  - 共 37 个文件约 1.1 MB；`src/audio/audio.test.ts` 校验文件、cue 表和授权一一对应。
- 音效表（cue → 素材 → 听感）：

| cue | 触发 | 素材 | 变体 |
|---|---|---|---|
| cast | 甩钩 | interface scroll（棘轮放绳） | 2 |
| reel | 收绳 | interface tick，每收 22 单位绳子响一下，越重越慢越低（最低 0.62 倍速） | 2 |
| throw | 扔出杂物 | impactSoft medium | 2 |
| grabFish / grabJunk / grabMonster | 钩到鱼 / 杂物 / 怪 | interface drop（水声）/ impactWood light / impactPunch medium | 3 / 2 / 2 |
| hit / bounce / kill | 砸中 / 弹开 / 打死 | impactPlank medium / impactMetal light / impactPunch heavy | 3 / 2 / 2 |
| blast / mine | 木桶炸开 / 水雷 | sci-fi explosionCrunch / lowFrequency explosion | 1 / 1 |
| coins / spat | 入账 / 贪吃鲨吐出 | interface glass / pluck | 3 / 2 |
| eat / eaten | 贪吃鲨开吃 / 吞下 | sci-fi slime / impactSoft heavy | 1 / 1 |
| leak | 码头受击 | impactWood heavy | 2 |
| buy / deny | 购买 / 钱不够 | interface confirmation / error | 1 / 1 |
| waveStart | 波次开始 | 港口钟 impactBell heavy | 1 |
| waveClear / over | 过波 / 失败 | 钢鼓 jingle 上行 / 下行 | 1 / 1 |

- 播放规则（`src/audio/`）：
  - 每个 cue 有最小间隔（入账 70 ms、击中 50 ms……），同一帧的一串事件不会叠成噪音；最多同时 12 个音效。
  - 多变体随机选、不连续重复同一个，再加 ±6% 随机变调。
  - 能听见 = 玩家开关 && 平台没静音 && 没暂停 && 页面可见；不能听见时挂起 AudioContext、暂停音乐。
  - 音效用 Web Audio，音乐用流式 `<audio>` 接进增益节点（iOS 不认 `.volume`）。第一次点击或按键时才解锁、加载。
  - 开关：HUD 暂停键旁的喇叭按钮，或按 M；存在平台存储里。

## 8. 已定（2026-11-08）

- **起重机**：胡桃木吊杆 + 黄铜绞盘 + 麻绳，配色和 UI 调色板一致。不做蒸汽吊车，它的铁灰色会和冷色海怪撞色。
- **操作员**：码头老船长只在商店和结算出现（半身像），海面上不画人，战场保持干净。
- **海怪阵营**：杂牌海洋生物，和模拟里的四种怪对应：
  - grunt：螃蟹兵（大钳子）
  - darter：海鳗（细长、快）
  - brute：海龟（厚壳、血厚）
  - glutton：贪吃鲨（背鳍、大嘴）
  - 全部冷色加红眼，每只靠剪影区分。
- **Style frame**：选定 `art/style/style_frame_r2.png`（三张里最平的一张）作为风格锚点，其余精灵都用"编辑样图"生成。
- **音频**：见第 7 节，全部 CC0，来源记在 `art/audio/credits.json`。
