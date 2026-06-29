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
