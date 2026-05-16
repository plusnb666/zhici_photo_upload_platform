/**
 * Lenis 平滑滚动
 *
 * 在 App.tsx 顶层调用一次即可，全站获得丝滑滚动体验
 *
 *   function App() {
 *     useLenisScroll();
 *     return <Routes>...</Routes>;
 *   }
 *
 * 注意：在有内部滚动的容器（如 Gallery 弹窗）上加 data-lenis-prevent
 */

import { useEffect } from 'react';
import Lenis from 'lenis';

export function useLenisScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
}
