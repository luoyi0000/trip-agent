# 智能旅行助手 — 项目总结

## 项目概述

智能旅行助手是一个基于 **React 19 + TypeScript + Vite** 构建的 AI 旅行规划单页应用（SPA）。用户可以在首页填写旅行偏好，AI 自动生成行程、预算规划和避坑指南，并通过聊天界面进行深度交互。项目采用 **Neo-Brutalism（新粗野主义）** 设计风格，视觉风格鲜明统一。

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建工具 | Vite |
| 路由 | React Router v7（HashRouter） |
| 动画 | Framer Motion 12 |
| 样式 | Tailwind CSS + CSS 自定义属性 |
| 图标 | Lucide React |
| UI 组件库 | Radix UI + shadcn/ui |
| 字体 | Nunito（Google Fonts） |

---

## 项目结构

```
app/
├── public/                          # 静态资源
│   ├── travel-deco.png              # 旅行装饰图
│   ├── dest-greatwall.jpg           # 长城图片
│   ├── dest-garden.jpg              # 园林图片
│   └── dest-balloon.jpg             # 热气球图片
├── src/
│   ├── main.tsx                     # 入口文件（HashRouter）
│   ├── App.tsx                      # 路由配置
│   ├── index.css                    # 全局样式 + Neo-Brutalism 工具类
│   ├── App.css                      # 应用样式
│   ├── lib/utils.ts                 # 工具函数
│   ├── hooks/use-mobile.ts          # 移动端检测 Hook
│   ├── pages/
│   │   ├── Home.tsx                 # 首页（规划表单 + Dashboard）
│   │   ├── Result.tsx               # 行程结果页
│   │   ├── Chat.tsx                 # AI 聊天界面
│   │   └── Favorites.tsx            # 收藏页面
│   └── components/ui/               # shadcn/ui 组件（50+ 个）
├── package.json
├── tailwind.config.js
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts
├── index.html
└── components.json                  # shadcn/ui 配置
```

---

## 页面与路由

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | Home.tsx | 首页：旅行规划表单 + 右侧 Dashboard（含行程概览、预算环图、美食/购物/避坑卡片） |
| `/result` | Result.tsx | 行程结果页：展示 10 天重庆旅行计划，含每日行程、预算明细、天气预报 |
| `/chat` | Chat.tsx | AI 聊天界面：支持智能规划、预算管理、避坑指南等话题的模拟对话 |
| `/favorites` | Favorites.tsx | 收藏页面：管理收藏的景点、美食、住宿和攻略 |

---

## 核心功能

### 1. 首页（Home.tsx）
- **左侧规划面板**：目的地城市、日期选择、交通方式、住宿偏好、旅行偏好标签（6 种）、额外要求输入
- **右侧 Dashboard**：
  - 默认显示"准备好出发了吗？"欢迎区域，含智能规划/预算管理/避坑指南快捷入口
  - 提交表单后切换为：AI 生成行程概览（3D 翻转卡片）、预算环图（带动画）、美食推荐/购物指南/避坑提示卡片
- **导航栏**：首页 / 行程 / 攻略 / 收藏，当前页面高亮显示

### 2. 行程结果页（Result.tsx）
- 顶部：城市标题、日期范围、返回按钮、编辑/下载按钮
- 导航栏（与首页一致）
- 旅行建议横幅
- 预算总览卡片（含分类明细）
- 10 天每日行程手风琴（含景点、餐饮、住宿推荐）
- 天气预报（10 天）
- 底部收藏按钮

### 3. AI 聊天界面（Chat.tsx）
- 根据 URL 参数 `?topic=` 自动设置对话上下文
- 支持话题：智能规划、预算管理、避坑指南、景点推荐、美食攻略、酒店对比、交通路线、预算优化、洪崖洞、解放碑
- 模拟 AI 回复，打字机效果
- 快捷回复按钮
- 返回首页

### 4. 收藏页面（Favorites.tsx）
- 展示收藏的景点、美食、住宿、攻略
- 支持删除收藏项
- 空状态引导"去规划旅行"
- 导航栏 + 底部页脚

---

## 设计系统：Neo-Brutalism

项目采用统一的 Neo-Brutalism 设计语言，核心特征：

| 样式类 | 用途 | 特征 |
|--------|------|------|
| `.neo-card` | 卡片容器 | 白色背景、3px 黑色边框、5px 阴影、圆角 |
| `.neo-card-sm` | 小卡片 | 2.5px 边框、3px 阴影 |
| `.neo-btn` | 按钮 | 圆角全、3px 边框、4px 阴影、按下回弹 |
| `.neo-input` | 输入框 | 2.5px 边框、聚焦时阴影上浮 |
| `.neo-select` | 下拉框 | 自定义箭头图标 |
| `.neo-tag` | 标签/药丸 | 2.5px 边框、2px 阴影 |
| `.neo-accordion` | 手风琴 | 2.5px 边框、3px 阴影 |
| `.neo-weather-card` | 天气卡片 | 2.5px 边框、3px 阴影 |
| `.text-highlight-*` | 高亮文本 | 彩色背景 + 黑色边框 |

### 设计色彩

- 背景：蓝色渐变（`#b8d8f4` → `#d0e4f8`）
- 强调色：粉色（`#ff69b4`）、薄荷绿（`#6bcb9e`）、薰衣草紫（`#a78bfa`）、珊瑚红（`#ff8a80`）、黄色（`#ffd93d`）、天蓝（`#64b5f6`）
- 文字：深色（`#1a1a2e`）、灰色（`#778`、`#99a`、`#889`）
- 边框：统一黑色（`#1a1a2e`）

### 动画

- `animate-float`：浮动动画（装饰元素）
- `animate-wiggle`：摇摆动画
- `animate-pop-in`：弹入动画
- `animate-slide-up`：上滑动画
- Framer Motion：页面切换、卡片入场（stagger children）、按钮按压（whileTap）、预算环图进度动画

---

## 数据流

- **表单数据**：Home.tsx 中 `FormData` 状态管理，提交后跳转 `/result`
- **路由参数**：Chat.tsx 通过 `useSearchParams` 读取 `?topic=` 参数决定 AI 上下文
- **模拟数据**：Result.tsx 内置重庆旅行数据（10 天行程、预算、天气）；Chat.tsx 内置 AI 回复映射表
- **收藏数据**：Favorites.tsx 使用 `useState` 管理，支持删除操作

---

## 关键依赖

| 包名 | 用途 |
|------|------|
| react 19 | UI 框架 |
| react-router 7 | 路由管理 |
| framer-motion 12 | 动画引擎 |
| lucide-react | 图标库 |
| tailwindcss | 原子化 CSS |
| @radix-ui/* | 无障碍 UI 原语 |
| class-variance-authority | 样式变体管理 |
| clsx | 类名合并 |
| date-fns | 日期处理 |
| embla-carousel-react | 轮播组件 |

---

## 开发命令

```bash
npm run dev      # 启动开发服务器（端口 3000）
npm run build    # TypeScript 检查 + Vite 构建
npm run lint     # ESLint 代码检查
npm run preview  # 预览构建产物
```

---

## 项目亮点

1. **统一的 Neo-Brutalism 设计语言**：所有组件风格高度一致，视觉冲击力强
2. **丰富的交互动画**：Framer Motion 驱动的卡片入场、按钮反馈、3D 翻转、进度环动画
3. **完整的用户流程**：首页填写 → AI 规划 → 查看行程 → 聊天深入 → 收藏管理
4. **模拟 AI 对话**：10+ 个话题的智能回复，打字机效果，沉浸式体验
5. **响应式布局**：桌面端左右分栏，移动端上下排列
6. **组件化架构**：可复用的 Neo-Brutalism 组件（SectionCard、NeoInput、NeoSelect 等）
