/**
 * 全局自定义鼠标
 *
 * 用法：
 *   1. 在 App.tsx 最外层包裹 <CursorProvider>
 *   2. 给可交互元素加 data-cursor="hover" 或自定义 data-cursor="text" / "drag"
 *
 * 鼠标会跟随移动 + hover 元素时变大 + 滞后跟随营造"惯性"感
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

type CursorVariant = 'default' | 'hover' | 'drag' | 'text' | 'hidden';

interface CursorContextValue {
  setVariant: (v: CursorVariant) => void;
}

const CursorContext = createContext<CursorContextValue>({ setVariant: () => {} });

export const useCursor = () => useContext(CursorContext);

export function CursorProvider({ children }: { children: ReactNode }) {
  const [variant, setVariant] = useState<CursorVariant>('default');
  const [visible, setVisible] = useState(false);

  /* 圆环用 spring 滞后跟随 */
  const ringX = useSpring(useMotionValue(-100), { stiffness: 350, damping: 32, mass: 0.4 });
  const ringY = useSpring(useMotionValue(-100), { stiffness: 350, damping: 32, mass: 0.4 });

  /* 点跟随更紧 */
  const dotX = useSpring(useMotionValue(-100), { stiffness: 900, damping: 40, mass: 0.2 });
  const dotY = useSpring(useMotionValue(-100), { stiffness: 900, damping: 40, mass: 0.2 });

  /* 检测是否触摸设备 */
  const isTouch = useRef(false);

  useEffect(() => {
    isTouch.current =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    if (isTouch.current) return;

    document.body.classList.add('has-custom-cursor');

    const handleMove = (e: MouseEvent) => {
      ringX.set(e.clientX);
      ringY.set(e.clientY);
      dotX.set(e.clientX);
      dotY.set(e.clientY);
      if (!visible) setVisible(true);
    };

    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    /* 通过 event delegation 探测 data-cursor 属性 */
    const handleOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-cursor]');
      if (target) {
        const v = target.getAttribute('data-cursor') as CursorVariant;
        setVariant(v || 'hover');
      } else {
        /* 在按钮/链接上默认 hover */
        const btnLike = (e.target as HTMLElement).closest('button, a, [role="button"]');
        setVariant(btnLike ? 'hover' : 'default');
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseover', handleOver);
    document.addEventListener('mouseleave', handleLeave);
    document.addEventListener('mouseenter', handleEnter);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseover', handleOver);
      document.removeEventListener('mouseleave', handleLeave);
      document.removeEventListener('mouseenter', handleEnter);
      document.body.classList.remove('has-custom-cursor');
    };
  }, [ringX, ringY, dotX, dotY, visible]);

  if (isTouch.current) return <>{children}</>;

  return (
    <CursorContext.Provider value={{ setVariant }}>
      {children}

      {/* 圆环（滞后） */}
      <motion.div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          translateX: ringX,
          translateY: ringY,
          x: '-50%',
          y: '-50%',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms, width 280ms cubic-bezier(0.22, 1, 0.36, 1), height 280ms cubic-bezier(0.22, 1, 0.36, 1), border-color 280ms',
        }}
        animate={{
          width:
            variant === 'hover' ? 56 :
            variant === 'drag'  ? 72 :
            variant === 'text'  ? 4  :
            variant === 'hidden'? 0  : 32,
          height:
            variant === 'hover' ? 56 :
            variant === 'drag'  ? 72 :
            variant === 'text'  ? 24 :
            variant === 'hidden'? 0  : 32,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            border: variant === 'text' ? 'none' : '1.5px solid #c8a96e', 
            background: variant === 'text' ? '#f8f5f0' : 'transparent',
            borderRadius: variant === 'text' ? 1 : '50%',
          }}
        />
      </motion.div>

      {/* 点（紧跟） */}
      <motion.div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          translateX: dotX,
          translateY: dotY,
          x: '-50%',
          y: '-50%',
          width: 4,
          height: 4,
          background: '#c8a96e',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: visible && variant !== 'hidden' && variant !== 'text' ? 1 : 0,
          transition: 'opacity 200ms',
        }}
      />
    </CursorContext.Provider>
  );
}
