# 像素赛博风 APP UI 设计提示词

## 一、整体风格

复古像素艺术（8-bit / 16-bit）+ 赛博朋克霓虹。所有图形严格遵守方形像素网格，边缘锯齿化，禁止抗锯齿。叠加 CRT 扫描线与噪点纹理，营造科幻未来感。

## 二、配色方案（色值）

**主色系（蓝紫渐变）**
- 深紫背景：`#0A0B2E`
- 中段紫：`#1E1B4B`
- 顶部星空紫：`#3B2C7A`
- 霓虹紫：`#A855F7`
- 主蓝紫：`#6366F1`
- 霓虹青：`#22D3EE`
- 霓虹品红：`#EC4899`

**辅助色（像素游戏）**
- 云朵高光：`#E0E7FF`，云朵中：`#A5B4FC`，云朵暗：`#6366F1`
- 金币黄：`#FBBF24`，屋顶橙：`#F97316`
- 警示红：`#EF4444`，生命绿：`#10B981`

**背景渐变**
```
linear-gradient(180deg, #0A0B2E 0%, #1E1B4B 40%, #3B2C7A 75%, #6366F1 100%)
```

## 三、字体与图标

**字体**
- 标题：`Press Start 2P`（中文用「站酷快乐体」），32-48px
- 正文：`VT323`（中文用「站酷小薇体」），14-16px
- 数字/计分：`Press Start 2P`，20-28px
- 所有标题加霓虹光晕：`text-shadow: 0 0 8px rgba(168,85,247,0.8)`

**图标**
- 32×32 或 64×64 像素网格内绘制，8-bit RPG 图标集
- 2px 像素硬描边 + 外层霓虹色光晕

## 四、页面布局

**1. 首页（游戏入口）**
- 顶部 HUD：金币数、玩家头像、HP 蓝条
- 中央：像素城堡/浮空岛装饰场景（氛围背景）
- 中段：章节卡片横向滑动列表（含解锁状态）
- 底部：`▶ 开始游戏`、`📋 存档` 按钮组

**2. 功能页（主玩法）**
- 顶部：返回键、关卡名、菜单键
- 中央：像素人物立绘区域
- 中下：对话文本框（打字机逐字显示）
- 底部：选项按钮 A / B / C

**3. 设置页**
- 顶部：返回键 + 标题
- 中部：角色立绘 + HP 条 + 音量/难度滑块
- 底部：存档 / 读档 / 退出按钮
- 分页标签：背包 / 技能 / 成就 / 设置

## 五、组件样式

**像素按钮**
- 背景：`linear-gradient(180deg, #6366F1, #4338CA)`
- 3px 硬边框 `#0A0B2E` + 内外阴影模拟厚度 + 霓虹外发光
- 悬停：上浮 2px，发光增强；按下：下沉 2px，白光闪烁
- 禁用：灰度 + 半透明 + 去发光

**卡片**
- 像素硬边（阶梯角替代圆角），2px 实色边框 + 4px 霓虹描边
- 半透明紫底 `rgba(30,27,75,0.85)` + 背景模糊
- 稀有度变体：普通（蓝紫）、稀有（金）、史诗（紫脉冲）、传说（彩虹渐变）

**生命条 / 进度条**
- 高 16px，黑色底 + 白色描边，内部 8px 分段刻度
- 填充色：HP=`#EF4444`、MP=`#3B82F6`、XP=`#FBBF24`

**对话框**
- 6px 像素描边 + 顶部小黑三角指向角色
- 打字机逐字显示（60ms/字）+ 终端光标闪烁

## 六、动效与交互

- 按钮悬停：上浮 2px + 发光扩散，150ms
- 按钮点击：下压 + 白光闪烁，80ms
- 卡片进入：下滑渐显 + 像素粒子飞溅，400ms
- 获得金币：数字递增 + 图标弹跳 + 粒子，600ms
- 进度条变化：阶梯式过渡 `steps(20)`，800ms
- 页面切换：像素化溶解消失/出现，350ms
- 持续氛围：星空漂移 + 霓虹呼吸，3s 循环
- 粒子系统：点击触发 8-12 个 4×4 像素方块飞溅渐隐

## 七、响应式适配

- 手机（320-767px）：单列，HUD 顶部固定，对话框占屏 40%，按钮全宽
- 平板（768-1023px）：双列卡片，对话框占屏 30%
- 桌面（1024px+）：居中容器 max-width 1200px，侧边栏显示角色状态
- 间距全部为 4px 倍数，图标锁定 16/24/32/48/64 五档，字体锁定 7 档
- 触摸热区最小 44×44px，横屏时 HUD 移至左侧
- 暗黑模式为默认；亮色可选复古 CRT 模式（暖黄 + 扫描线强化）

## 八、可访问性

- 交互元素 `:focus-visible` 加 2px 像素黄 `#FBBF24` 描边
- 遵循 `prefers-reduced-motion`：关闭粒子与呼吸光
- 文字对比度 ≥ 4.5:1（WCAG AA），最小字号 12px

## 九、生成指令（精简版）

> Generate a mobile app UI in retro pixel art style with cyberpunk neon blue-purple gradient theme. Use 8-bit/16-bit pixel grid with hard edges and CRT scanline. Color tokens: deep purple `#0A0B2E → #1E1B4B → #3B2C7A → #6366F1`, neon accents `#A855F7 / #22D3EE / #EC4899`, gold `#FBBF24`. Fonts: `Press Start 2P` headings, `VT323` body. Components: pixel buttons with 3px hard border + neon glow, RPG cards with stepped corners, segmented HP/MP bars, typewriter dialog boxes, click pixel particles. Pages: Home (HUD + chapter cards), Gameplay (sprite + dialog), Settings (sprite + sliders). Animations: 150ms hover lift, 80ms press flash, pixel dissolve transitions, 3s neon breathing. Responsive 320/768/1024px, 4px spacing grid, WCAG AA.
