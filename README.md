# From Random To Organized Shop - UX Design H5

跨境电商首页重构设计展示页面，共 6 屏纵向拼接，基于 Pixelator 设计稿 AST 手工还原。

## 目录结构

```
├── index.html          # 主页面（6屏 HTML 结构）
├── css/
│   ├── base.css        # Reset + CSS变量 + 滚动容器
│   ├── components.css  # 可复用组件（Header / Quote / Phone Card 等）
│   └── sections.css    # 各屏特有定位与布局样式
├── js/
│   └── scroll.js       # Section 5 滚动驱动帧切换逻辑
└── README.md
```

## 页面结构

| 屏 | 标题 | 高度 | 说明 |
|---|---|---|---|
| S1 | From Random To Organized Shop | 1710px | 封面页，三张手机卡片 + 标题 |
| S2 | 现状梳理 | 1512px | 六张手机截图 + 数据统计 + 引言 |
| S3 | 问题与策略 | 864px | 三层卡片（体验层/业务层/技术层）+ 问题策略对照 |
| S4 | 三组机制 | 864px | 三列布局（基建重构/流量分级/体验升维）|
| S5 | 基建重构详解 | 2592px | 3帧滚动切换（全局锁定层/弹性适配层/国别定制层）|
| S6 | 拉通首页标准化框架 | 1080px | Before 对照页，手机截图 + 标注说明 |

## 交互特性

- **分页吸附**：CSS `scroll-snap-type: y mandatory`，每屏边界自动吸附
- **S5 帧切换**：滚动驱动 3 帧内容切换，右侧面板带 500ms 垂直滑动动画（左侧不动）
- **手机卡片 Hover**：上浮 + 阴影效果

## 技术要点

- 纯静态 HTML/CSS/JS，无框架依赖
- 模块化 CSS 架构：base → components → sections
- Section 5 使用 `position: sticky` 实现固定容器内的帧切换
- 动画缓动：`cubic-bezier(0.4, 0, 0.2, 1)`

### Section 两侧通屏背景色方案

当某个 Section 的背景色与页面默认背景（`#F0F0F0`）不同时（如 S14/S15 为黑色），需要让浏览器窗口两侧的空白区域也跟随变色。

**问题**：`.page-wrapper` 固定宽度 1440px 居中，两侧露出的是 `body` 的背景色。如果用 JS 在翻页时切换 `body` 背景色，会在页面滑动瞬间跳变，体验不好。

**方案**：在 Section 底层铺设一个超宽伪元素，跟随 Section 一起滚动，实现无跳变的颜色过渡。

1. **`page-wrapper` 改用 `clip-path` 替代 `overflow: hidden`**，仅保留垂直裁剪，水平方向放开：
   ```css
   .page-wrapper {
     clip-path: inset(0 -200vmax); /* 垂直裁剪，水平不裁剪 */
   }
   ```

2. **目标 Section 解除溢出限制**，并添加超宽伪元素作为通屏底色：
   ```css
   .s14 {
     overflow: visible;    /* 覆盖 .section 的 overflow: hidden */
     contain: style;       /* 移除 paint/layout 以允许伪元素溢出 */
   }
   .s14::before {
     content: '';
     position: absolute;
     top: 0;
     bottom: 0;
     left: 50%;
     width: 9999px;
     transform: translateX(-50%);
     background: #000;
     z-index: 0;
   }
   ```

3. **无需任何 JS**——伪元素随 Section 一起被 `translateY` 驱动滑入/滑出，颜色过渡完全跟随页面滚动，天然无跳变。
