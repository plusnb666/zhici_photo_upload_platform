/**
 * 赤子の相册 · Motion 共用配置
 *
 * 设计原则（Apple 风格）：
 *   - 轻阻尼 spring，stiffness 中低（200-300），damping 中高（30-40）
 *   - duration-based 用 cubic-bezier(0.22, 1, 0.36, 1) — 标准减速
 *   - 入场全部 fadeUp，距离不超过 20px
 *   - 退场比入场快 30% — 用户感受"利落"
 */

import type { Transition, Variants } from 'framer-motion';

/* ─── Spring 预设 ─── */
export const spring = {
  /** 默认弹簧 — 大多数 UI 反馈用这个 */
  default: {
    type: 'spring',
    stiffness: 260,
    damping: 32,
    mass: 0.8,
  } as Transition,

  /** 轻盈 — 微交互、hover */
  soft: {
    type: 'spring',
    stiffness: 200,
    damping: 26,
    mass: 0.6,
  } as Transition,

  /** 稳定 — 大块面板移动 */
  stiff: {
    type: 'spring',
    stiffness: 380,
    damping: 38,
    mass: 1,
  } as Transition,

  /** 慢温吞 — 装饰性元素 */
  slow: {
    type: 'spring',
    stiffness: 120,
    damping: 24,
    mass: 1.2,
  } as Transition,
};

/* ─── Duration-based 缓动（Apple 标准）─── */
export const ease = {
  /** 标准减速 — 入场首选 */
  out: [0.22, 1, 0.36, 1],
  /** 柔和减速 */
  outSoft: [0.4, 0, 0.2, 1],
  /** 玻璃质感 — 滑动切换 */
  glass: [0.7, 0.1, 0.3, 1],
  /** 加速入场 — 退场用 */
  in: [0.4, 0, 1, 1],
} as const;

/* ─── 通用 Variants ─── */

/** 单元素入场 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: ease.out },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.3, ease: ease.in },
  },
};

/** 缩放渐入 */
export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: ease.out },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.25, ease: ease.in },
  },
};

/** 容器 — 子元素错落入场 */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

/** 配合 staggerContainer 使用的子元素 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: ease.out },
  },
};

/* ─── 页面切换 ─── */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: ease.out },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.3, ease: ease.in },
  },
};

/* ─── Hover 反馈 ─── */
export const hoverLift = {
  whileHover: { y: -4, transition: spring.soft },
  whileTap:   { y: -1, transition: spring.stiff },
};

export const hoverScale = {
  whileHover: { scale: 1.02, transition: spring.soft },
  whileTap:   { scale: 0.98, transition: spring.stiff },
};

/* ─── 拖拽中视觉反馈 ─── */
export const dragVisual = {
  scale: 1.05,
  rotate: -2,
  zIndex: 50,
  boxShadow: '0 24px 48px rgba(44,42,39,0.25)',
  transition: spring.soft,
};

/* ─── 图片"打开"过渡（gallery → detail 共享元素）─── */
export const sharedImageTransition: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 36,
  mass: 0.9,
};
