# 图标系统规范

## 尺寸层级

| Token | 尺寸 | 用途 | 示例场景 |
|-------|------|------|----------|
| `2xs` | 8px | 极小标记 | Badge 圆点、状态指示器 |
| `xs` | 12px | 紧凑 UI | 列表行内图标、标签图标 |
| `sm` | 14px | 辅助图标 | 按钮内图标、输入框图标 |
| `md` | 16px | 默认尺寸 | 导航图标、操作图标 |
| `lg` | 24px | 强调图标 | 空状态、功能入口 |

## 视觉重心规则

### 1. 光学对齐
- 图标容器使用 `display: grid; place-items: center` 确保视觉居中
- 图标本身尺寸统一，通过容器控制布局位置
- 避免使用 margin 微调图标位置，应通过容器对齐

### 2. 尺寸一致性
- 同一组件内所有图标必须使用同一尺寸层级
- 按钮内图标固定使用 `sm` (14px) 或 `md` (16px)
- 列表行图标固定使用 `md` (16px)
- 标签页图标固定使用 `md` (16px)

### 3. 描边宽度
- 默认描边：`1.6px`（对应 Lucide 图标标准）
- 强调描边：`2px`（用于导航等需要强调的图标）
- 所有图标必须通过 `strokeWidth` prop 或 CSS 变量控制，禁止硬编码

### 4. 移动端特殊规则
- 移动端可点击图标最小尺寸：44×44px（容器）
- 图标本身尺寸仍遵循上述层级
- 通过容器 padding 实现触控区域，而非放大图标

## 组件映射

### Web 端
| 组件 | 图标尺寸 | 容器尺寸 |
|------|----------|----------|
| Button (默认) | `sm` (14px) | auto |
| Button (xs) | `xs` (12px) | auto |
| Button (lg) | `md` (16px) | auto |
| IconButton | `md` (16px) | 30px |
| Listbox | `sm` (14px) | auto |
| Menu | `sm` (14px) | auto |
| NavigationPanel | `sm` (14px) | auto |
| Tab | `sm` (14px) | auto |

### Mobile 端
| 组件 | 图标尺寸 | 容器尺寸 |
|------|----------|----------|
| MobileButton | `sm` (14px) | 20px |
| MobileIconButton | `md` (16px) | 44px |
| MobileListRow | `md` (16px) | 20px |
| MobileTabBar | `md` (16px) | 64×32px |
| MobileBanner | `md` (16px) | 20px |
| MobileCheckbox | `sm` (14px) | 20px |
| MobileRadioGroup | `md` (16px) | 20px |
| MobileStepper | `md` (16px) | 44px |
| MobileStatus | `lg` (24px) | 28px |
| MobileDisclosure | `md` (16px) | 20px |
| MobileTag | `sm` (14px) | 16px |

## 实施检查清单

- [ ] 所有图标使用 design-tokens 中定义的尺寸变量
- [ ] 禁止在组件中硬编码图标尺寸
- [ ] 图标容器使用 grid 居中
- [ ] 移动端触控区域 ≥ 44px
- [ ] 描边宽度使用 token 控制
