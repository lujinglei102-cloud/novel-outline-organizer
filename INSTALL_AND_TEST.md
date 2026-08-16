# 小说大纲梳理器 - 安装与测试指南

> 前置要求：Windows + Node.js ≥ 18（推荐 20 LTS）+ 已开启 VPN（网络可访问 https://registry.npmjs.org 或 https://registry.npmmirror.com）

---

## 一、快速开始（3 步跑起来）

打开 PowerShell（或 cmd），进入项目目录：

```powershell
cd d:\app\小说大纲辅助器
```

### 第 1 步：安装依赖（任选一种，VPN 推荐默认源）

```powershell
# 方案 A：官方源（VPN 连通时最稳）
npm install

# 方案 B：如果官方源慢，用淘宝镜像（二选一）
npm install --registry=https://registry.npmmirror.com
```

> 💡 若 npm 被 PowerShell 执行策略拦截（`npm.ps1 cannot be loaded`），改用：
> ```powershell
> node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install
> ```

### 第 2 步：启动本地开发

```powershell
npm run dev
```

浏览器会自动打开（默认 http://localhost:5173 或终端提示的地址）。

### 第 3 步：执行端到端编译 + 所有测试（一次性全部校验）

```powershell
# (a) 类型检查 + 生产构建（相当于整个前端编译是否成功）
npm run build

# (b) 运行全部单元测试（engine 逻辑 + 前端组件 vitest）
npm run test
```

---

## 二、详细测试层级说明

### 📦 层级 0：纯 Node 引擎测试（不需要 npm install，直接跑）

对应文件：`test/engine.test.mjs`（28 个用例）

```powershell
node test/engine.test.mjs
```

**覆盖内容**：分词 & 姓名识别 / 叙事线排序（含间隙检测）/ 角色抽取 & 冲突标签 / 伏笔关联（关键词共现）/ 情绪标注 / 预设模板 / 骨架方向生成 / 章节切分。

✅ 预期输出：`PASSED 28 / 28`。

---

### 📦 层级 1：TypeScript 类型检查

```powershell
npx tsc -b
```

- 检查所有 `.ts / .tsx` 文件的类型（不会执行代码）
- 0 error 即通过
- 如果报错：`Cannot find module '@/...'` 说明路径别名没生效，请确认有 `vite.config.ts` + `tsconfig.json` 里已配置

---

### 📦 层级 2：Vite 生产构建（真实打包）

```powershell
npm run build
```

产出 `dist/` 目录（可直接部署到任何静态托管）。
该命令同时先执行 `tsc -b`，所以类型错误会在此阶段先报出。

---

### 📦 层级 3：Vitest 单元/组件测试（前端侧）

```powershell
npm run test            # 单次运行
npm run test:watch      # watch 模式
npm run test:ui         # 浏览器 UI 模式
```

测试搜索路径：`src/**/*.test.ts(x)` / `test/**/*.test.ts(x)`。
目前主要断言为 engine 层，组件层若未写测试是可接受的（Sprint 8 补齐）。

---

## 三、手动验收（按用户旅程 1:1 走一遍）

> 在 `npm run dev` 打开的浏览器中操作。

### 🎯 阶段一：灵感录入（`/cards`）

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 1-1 | 点击左上角 `+ 新卡片`，输入文字（≤500），保存 | 卡片出现在墙面上，倒序排列，有「刚刚」时间戳 |
| 1-2 | 新建 15+ 张卡，内容中包含角色名（沈清辞、陆珩、顾云深…）、关键词（玉佩、信、枪伤、遗嘱…） | 输入被截断在 500 字以内，剩余字数实时递减 |
| 1-3 | 单击卡片 → 打开详情弹窗 → 点「编辑」→ 修改内容并保存 | 原卡片内容更新，时间仍为原创建时间 |
| 1-4 | 在详情里点「删除」→ 确认 | 卡片消失，底部状态栏数量减少 |
| 1-5 | 双击卡片 | 直接进入编辑弹窗 |
| 1-6 | 新建/编辑时选择「前期/中期/后期」 | 卡片右下角出现 `[前期]` 等阶段标签 |

### 🎯 阶段二：一键梳理（`/sort`）

顶部 4 个 tab：**叙事线 / 角色 / 伏笔 / 情绪**

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 2-1 | 进入页面 → 自动执行「叙事线排序」 | 卡片按时间 + stage 权重排序，编号 1、2、3… 左侧显示序号 |
| 2-2 | 找编号后的「💡 建议补卡片」黄条 / 红条 | 若阶段跳变会出现提示与建议描述 |
| 2-3 | 切到「角色识别」tab | 等待数秒后左栏出现角色列表，按提及次数降序，有冲突标签与代表描述 |
| 2-4 | 左栏点某角色 | 右侧展示该角色的全部出场卡片缩略图 |
| 2-5 | 切到「伏笔关联」tab | 展示卡片两两共现的关键词（如玉佩、遗嘱…），状态区分「已埋 / 待确认」 |
| 2-6 | 切到「情绪标注」tab → 上方 ECharts 曲线图 | 蓝线（实际情绪）从 -5 到 5，标记点大小随强度变 |
| 2-7 | 点曲线上的点 | 弹出编辑对话框，可改情绪值 + 强度，保存后曲线立即刷新 |
| 2-8 | 点「批量重新标注」 | 所有卡片情绪被重新评估，曲线更新 |
| 2-9 | 右上角「进入骨架构建 →」 | 跳转到阶段三 |

### 🎯 阶段三：骨架 & 章节（`/outline`）

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 3-1 | 进入页面自动加载骨架方向（方案 1/2/3/4/5，分别对应 5 个模板） | 每个方案卡片显示结构名 + 比例 |
| 3-2 | 切换方案 1 → 方案 2 | 下方节点卡片分布与占比立即更新，结构节点名同步变化 |
| 3-3 | 「重新生成方向」按钮 | 5 个方案按当前卡片重新计算分界 |
| 3-4 | 在结构节点编辑器里，点节点旁 ✎ 重命名，或在输入框 +添加 | 节点列表动态变化 |
| 3-5 | 情绪曲线：虚线黄色=模板理想，蓝色实线=实际 | 两条曲线同坐标显示 |
| 3-6 | 每节点章节数选择 2 → 按方向重新生成章节 | 章节总数 = 节点数 × 2，按节点分组，每章显示标题+冲突+分配到的卡片 |
| 3-7 | 某章点「编辑」→ 改标题 + 改冲突 → 保存 | 视图立即更新，写入 IndexedDB |
| 3-8 | 右上角「导出大纲 →」 | 跳转导出页 |

### 🎯 阶段四：导出（`/export`）

| 步骤 | 操作 | 预期结果 |
| --- | --- | --- |
| 4-1 | 点击「下载 Markdown」 | 生成 `小说大纲.md` 并下载，包含：角色表、章节分组、每章标题+冲突、所有灵感卡索引 |
| 4-2 | 点击「下载纯文本」 | `小说大纲.txt`，Markdown 标记被剥离 |
| 4-3 | 点击「复制 Markdown」/「复制纯文本」 | 按钮显示 ✓ 已复制，粘贴到编辑器检查内容 |

### 🎯 移动端 & 响应式

用 Chrome DevTools 切到 iPhone/Android 尺寸（宽度 ≤ 768px）：
- 顶栏显示 4 个移动端底部 tabbar（阶段一/二/三/导出）
- 卡片网格从 4 列 → 2 列 → 1 列
- 「角色识别」两栏改为上下堆叠

---

## 四、常见问题排查

1. **`npm install` 卡住或 `npm ERR! code ECONNRESET`**
   - 确认 VPN 已开启全局模式；若仍有问题切到 `--registry=https://registry.npmmirror.com`
2. **Tailwind 样式没生效（页面是裸 HTML）**
   - `tailwind.config.js` 的 `content` 路径需覆盖 `./src/**/*.{ts,tsx}`，`postcss.config.js` 需正常引用 tailwind 插件；通常重新运行 `npm run dev` 即可
3. **IndexedDB 打不开 / 数据没保存**
   - 确保用 `http://localhost` 协议（不是 `file://`）；浏览器隐私模式禁用持久化，请用普通模式
4. **ECharts 曲线图空白**
   - 控制台检查 JS 错误：若 Dexie / Zustand 报 undefined，通常是 npm install 未完整执行，重跑 `npm install` 后 `rm -r node_modules` 再装一次

---

## 五、最终交付检查清单（执行完「一、快速开始」后确认）

```
✅ node test/engine.test.mjs  → PASSED 28 / 28
✅ npx tsc -b                 → 0 errors
✅ npm run build              → Build completed in Xs，产出 dist/
✅ npm run test               → Test Files 全部 passed
✅ 手动验收 阶段一~四          → 全部通过
```
