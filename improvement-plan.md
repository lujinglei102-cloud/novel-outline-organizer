# 小说大纲梳理器 - 改进方案

> 版本：v1.0 | 日期：2026-08-17 | 基于完整功能体验与源码分析

---

## 一、问题汇总

### 1.1 性能问题

| # | 问题 | 根因 | 严重度 |
|---|------|------|--------|
| 1 | 首次加载卡顿/白屏 | `index.html` 从 Google Fonts 加载中文字体（ZCOOL KuaiLe + Noto Sans SC 多字重），`fonts.googleapis.com` 和 `fonts.gstatic.com` 在国内被墙，浏览器挂起等待超时，40+ 个 woff2 文件无法下载 | **高** |
| 2 | 子页面刷新 404 | GitHub Pages 不支持 SPA history 路由模式，刷新 `/cards`、`/sort`、`/outline`、`/export` 等路径时服务端返回 404 | **高** |

### 1.2 功能 Bug

| # | 问题 | 根因 | 严重度 |
|---|------|------|--------|
| 3 | 角色识别大量误判 | `tokenizer.ts` 的 `tokenize()` 对未匹配的连续 2 字直接生成候选词；`isNameCandidate()` 只要首字是姓氏就判定为角色名。导致 `commonVocab` 中的"分手""误会""身份""揭露""重逢"等情节词汇被识别为角色 | **高** |
| 4 | 骨架分界出现 -200% | `skeletonGen.ts` 的 `buildDirection()` 中 `endIndex` 计算逻辑有 bug：当卡片数量较少时，`Math.max(i, Math.min(...))` 可能导致 `afterCardIndex` 非单调递增，`splitIntoChapters()` 中出现 `start > end`，段内卡片数为负 | **高** |

### 1.3 功能缺失

| # | 问题 | 严重度 |
|---|------|--------|
| 5 | 拖拽排序未实现（阶段二 UI 提示了"拖拽卡片可调整顺序"，但实际不可拖拽） | 中 |
| 6 | 阶段一卡片列表缺少编辑/删除按钮 | 中 |
| 7 | 无数据备份/恢复功能（数据仅存 localStorage，清缓存即丢失） | 中 |
| 8 | 无键盘快捷键（Ctrl+S 保存 / Esc 关闭 / Ctrl+N 新建） | 低 |
| 9 | 无新手引导/示例数据（首次打开全空白） | 低 |
| 10 | 阶段一无法导出（必须完成阶段三骨架构建后才能导出） | 低 |
| 11 | 移动端布局可进一步优化 | 低 |

---

## 二、解决方案

### 2.1 字体卡顿修复

**涉及文件：** `index.html`、`src/index.css`

**方案：**

1. 从 Google Fonts 下载所需字体文件到 `public/fonts/`：
   - ZCOOL KuaiLe（仅 regular 字重）
   - Noto Sans SC（仅 400、500、700 三个字重，使用 `unicode-range` 分片或只保留常用字集）
2. 在 `src/index.css` 中用 `@font-face` 本地引入
3. 删除 `index.html` 中的 Google Fonts `<link>` 标签和 `<link rel="preconnect">` 标签
4. 添加系统字体 fallback：`font-family: 'ZCOOL KuaiLe', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif`

**备选方案（更轻量）：**
- 正文使用系统默认中文字体（PingFang SC / Microsoft YaHei），仅 ZCOOL KuaiLe 保留本地加载用于标题

---

### 2.2 路由 404 修复

**涉及文件：** 新增 `public/404.html`、`index.html`

**方案 A（推荐）：** 添加 `404.html` 做 SPA 重定向

```html
<!-- public/404.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <script>
    sessionStorage.redirect = location.href;
  </script>
  <meta http-equiv="refresh" content="0;URL='/'">
</head>
</html>
```

同时在 `index.html` 的 `<head>` 中添加：

```html
<script>
  (function () {
    var redirect = sessionStorage.redirect;
    delete sessionStorage.redirect;
    if (redirect && redirect !== location.href) {
      history.replaceState(null, null, redirect);
    }
  })();
</script>
```

**方案 B：** 改用 Hash 路由（`createHashRouter` 替代 `createBrowserRouter`），URL 变为 `/#/cards` 格式，天然支持刷新。

---

### 2.3 角色识别修复

**涉及文件：** `src/engine/tokenizer.ts`、`src/engine/characterExtract.ts`

**问题分析：**

1. `commonVocab` 混合了角色名和情节关键词，导致"分手""误会""身份"等被判定为角色
2. `tokenize()` 的 fallback 逻辑（第 70-75 行）对未匹配的连续 2 字直接生成候选词，噪声太大
3. `isNameCandidate()` 仅检查首字是否为姓氏，未验证整个词是否像人名
4. 无最低频次过滤，偶然出现的词汇也被当作角色

**修复方案：**

1. **拆分 `commonVocab`** 为两个独立列表：
   - `nameVocab`：仅包含角色名（"沈知行""林婉清""顾言""傅景深"等）
   - `plotVocab`：情节关键词（"分手""误会""重逢""追妻"等），不再参与角色识别

2. **改进 `isNameCandidate()`**：
   - 检查词是否在 `nameVocab` 中 → 直接通过
   - 检查词是否在 `plotVocab` 中 → 直接拒绝
   - 检查首字是姓氏 AND 每个字都是常见人名字 → 通过
   - 新增 `nameCharSet`（常见人名字库），包含"知行婉清言语琛霆寒衍越淮西时"等

3. **改进 `tokenize()` 的 fallback**：
   - 未匹配的 2 字词不再无条件生成，仅当 `isNameCandidate()` 为 true 时才添加

4. **增加最低频次阈值**（`characterExtract.ts`）：
   - 需要出现在 ≥2 张卡片中才算角色
   - 过滤掉 `mentionCount < 2` 的条目

---

### 2.4 骨架 -200% 修复

**涉及文件：** `src/engine/skeletonGen.ts`

**问题分析：**

`buildDirection()` 函数中 `endIndex` 的计算逻辑：

```typescript
const endFloat = Math.round(cumulative * N) - 1
const endIndex = i === segments - 1 
  ? N - 1 
  : Math.max(i, Math.min(N - 1 - (segments - 1 - i), endFloat))
```

当 N（卡片总数）小于 segments（段数）时：
- `endFloat` 可能为负数
- `Math.max(i, ...)` 强制 `endIndex >= i`，但下一段的 `start` 可能 > `end`，导致负跨度

**修复方案：**

1. **确保 `afterCardIndex` 单调递增**：添加验证和修正逻辑

```typescript
// 确保每个段至少有 1 张卡片
for (let i = 0; i < segments; i++) {
  const minEnd = i  // 第 i 段至少覆盖到第 i 张卡片
  const maxEnd = N - 1 - (segments - 1 - i)  // 给后面段至少留 1 张
  const endIndex = i === segments - 1 
    ? N - 1 
    : Math.max(minEnd, Math.min(maxEnd, endFloat))
  boundaries.push({ nodeIndex: i, afterCardIndex: endIndex })
}
```

2. **`splitIntoChapters()` 增加保护**：

```typescript
const start = seg === 0 ? 0 : boundaries[seg - 1].afterCardIndex + 1
const end = boundaries[seg].afterCardIndex
// 保护：如果 start > end，至少取 1 张卡片
if (start > end) {
  const cardIds = sortedCards.slice(start, start + 1).map(x => x.id)
  // ... 创建章节
  continue
}
```

3. **当 N < segments 时**：自动合并尾部段，保证每个段至少有 1 张卡片

---

### 2.5 拖拽排序实现

**涉及文件：** `src/routes/CardsPage.tsx`、`src/routes/SortPage.tsx`

**方案：**
- 使用 HTML5 Drag and Drop API（0 依赖）
- 在卡片上添加拖拽手柄图标（⠿ 或 ⣿）
- 拖拽时显示视觉反馈（阴影 + 插入位置指示线）
- 拖拽结束后更新卡片排序并持久化

---

### 2.6 卡片编辑/删除按钮

**涉及文件：** `src/components/CardThumb.tsx`、`src/routes/CardsPage.tsx`

**方案：**
- 在 `CardThumb` 组件添加编辑（✎）和删除（✕）按钮
- 编辑按钮：打开已有的 `CardEditModal`
- 删除按钮：弹出确认对话框，确认后删除
- 按钮默认隐藏，hover 时显示

---

### 2.7 数据备份/恢复

**涉及文件：** 新增 `src/components/BackupRestore.tsx`、`src/routes/CardsPage.tsx`

**方案：**
- **导出备份**：将所有 localStorage 数据序列化为 JSON，触发浏览器下载
- **导入恢复**：文件选择器读取 JSON，校验后覆盖写入 localStorage
- 入口放在阶段一页面的设置区域

---

### 2.8 键盘快捷键

**涉及文件：** `src/routes/CardsPage.tsx`、`src/components/CardEditModal.tsx`

**方案：**
- 在 `CardsPage` 添加全局 `keydown` 监听：
  - `Ctrl+N`：打开新建卡片弹窗
- 在 `CardEditModal` 添加：
  - `Ctrl+S`：保存卡片
  - `Esc`：关闭弹窗（已有隐式支持，需显式绑定）

---

### 2.9 新手引导

**涉及文件：** `src/routes/CardsPage.tsx`、新增 `src/data/sampleCards.ts`

**方案：**
- 首次访问时自动创建 3-4 张示例卡片，展示不同阶段和情绪
- 添加简单的引导提示（首次显示，可关闭）
- 在 `localStorage` 中记录 `onboarding-completed` 标记

---

### 2.10 阶段一导出功能

**涉及文件：** `src/routes/ExportPage.tsx`、`src/routes/CardsPage.tsx`

**方案：**
- 在阶段一卡片页也提供"导出灵感清单"按钮
- 导出格式：按卡片排序的纯文本/Markdown，包含标题、内容、阶段标签、情绪值

---

### 2.11 移动端适配优化

**涉及文件：** `src/index.css`

**方案：**
- 添加 `@media (max-width: 768px)` 断点
- 卡片从多列布局改为单列
- 导航栏改为底部固定或折叠菜单
- 弹窗改为全屏模式

---

## 三、实施顺序

按优先级和依赖关系，建议分 4 批实施：

| 批次 | 内容 | 预估改动 |
|------|------|----------|
| **第 1 批** | 字体卡顿 + 路由 404 + 角色识别 + 骨架 -200% | 5 个文件 |
| **第 2 批** | 拖拽排序 + 编辑/删除按钮 + 数据备份 | 4 个文件 |
| **第 3 批** | 键盘快捷键 + 新手引导 + 阶段一导出 | 5 个文件 |
| **第 4 批** | 移动端适配 | 1 个文件 |

---

## 四、技术约束

- 所有修复保持 0 外部 API 依赖（第一版设计原则）
- 不引入新的 npm 包（拖拽用原生 HTML5 Drag API）
- 保持现有数据模型兼容，不破坏 localStorage 已有数据
- 每个修复完成后运行对应测试，确保不引入回归