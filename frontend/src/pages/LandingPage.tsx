/**
 * 赤子の相册 · Landing Page
 * 风格：Japandi 暖米白 + 3D 漂浮图墙
 *
 * 核心交互：
 *   - 公开图片以 InstancedMesh 形式漂浮在 3D 空间
 *   - 鼠标拖拽旋转视角（OrbitControls，自动慢转）
 *   - 滚轮缩放
 *   - 点击图片飞到详情页（共享 layoutId 过渡到 ImageDetail）
 *   - 左下角控制：grid / 3d 视图切换
 *
 * 依赖：
 *   npm i three @react-three/fiber @react-three/drei framer-motion
 */

import { useState, useRef, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

import { imagesAPI } from '../api/images';
import { tagsAPI } from '../api/tags';
import { useAuthStore } from '../store/authStore';
import { fadeUp, staggerContainer, staggerItem, ease, spring } from '../utils/motion';

import '../styles/theme.css';

/* ─────────────────────────────────────────
 *  3D 单张图片平面
 * ───────────────────────────────────────── */
interface FloatingImageProps {
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number];
  onClick: () => void;
}

function FloatingImage({ url, position, rotation, scale, onClick }: FloatingImageProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  /* 加载纹理 */
  const texture = useMemo(() => {
  const tex = new THREE.TextureLoader().load(url);
  return tex;
}, [url]);

  /* 帧动画：轻微漂浮 + hover 凸出 */
  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    /* 漂浮：每张图相位偏移 */
    const phase = position[0] + position[1];
    mesh.current.position.y = position[1] + Math.sin(t * 0.5 + phase) * 0.06;
    mesh.current.position.z = position[2] + Math.cos(t * 0.4 + phase) * 0.04;

    /* hover 时朝向相机一点 */
    const targetScale = hovered ? 1.08 : 1;
    mesh.current.scale.x += (scale[0] * targetScale - mesh.current.scale.x) * 0.1;
    mesh.current.scale.y += (scale[1] * targetScale - mesh.current.scale.y) * 0.1;
  });

  return (
    <mesh
      ref={mesh}
      position={position}
      rotation={rotation}
      scale={[scale[0], scale[1], 1]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={onClick}
    >
      <planeGeometry args={[1, 1]} />
      {texture ? (
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} transparent />
      ) : (
        <meshBasicMaterial color="#c8a96e" opacity={0.4} transparent />
      )}
    </mesh>
  );
}

/* ─────────────────────────────────────────
 *  3D 场景
 * ───────────────────────────────────────── */
function Scene({ images, onPick }: { images: any[]; onPick: (id: number) => void }) {
  /* 计算图片在 3D 空间里的分布 — 球面分布 + 抖动 */
  const placements = useMemo(() => {
    return images.map((img, i) => {
      const phi = Math.acos(1 - 2 * (i + 0.5) / images.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i; // golden angle
      const r = 4 + Math.random() * 1.5;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      /* 让每张图朝向中心 */
      const lookAt = new THREE.Vector3(0, 0, 0);
      const pos = new THREE.Vector3(x, y, z);
      const dir = lookAt.sub(pos).normalize();
      const euler = new THREE.Euler();
      euler.y = Math.atan2(dir.x, dir.z);
      euler.x = -Math.asin(dir.y);

      /* 宽高根据图片比例 */
      const aspect = (img.width || 4) / (img.height || 3);
      const s = 1.4 + Math.random() * 0.4;
      return {
        position: [x, y, z] as [number, number, number],
        rotation: [euler.x, euler.y, 0] as [number, number, number],
        scale: [s * aspect, s] as [number, number],
      };
    });
  }, [images]);

  /* 整体场景缓慢旋转 */
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.elapsedTime * 0.04;
    }
  });

  return (
    <>
      {/* 微弱环境光 */}
      <ambientLight intensity={0.8} />

      <group ref={group}>
        {images.map((img, i) => (
          <FloatingImage
            key={img.id}
            url={img.thumbnail_url || img.url}
            position={placements[i].position}
            rotation={placements[i].rotation}
            scale={placements[i].scale}
            onClick={() => onPick(img.id)}
          />
        ))}
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={4}
        maxDistance={14}
        autoRotate={false}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
      />
    </>
  );
}

/* ─────────────────────────────────────────
 *  备用 2D 网格视图（数据为空或用户切换）
 * ───────────────────────────────────────── */
function GridView({ images, onPick }: { images: any[]; onPick: (id: number) => void }) {
  return (
    <motion.div
      className="lp-grid-2d"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {images.map((img) => (
        <motion.div
          key={img.id}
          className="lp-grid-card"
          variants={staggerItem}
          layoutId={`image-${img.id}`}
          whileHover={{ y: -4, transition: spring.soft }}
          onClick={() => onPick(img.id)}
          data-cursor="hover"
        >
          <motion.img
            src={img.thumbnail_url || img.url}
            alt={img.filename}
            loading="lazy"
            layoutId={`image-img-${img.id}`}
          />
          <div className="lp-grid-meta">
            <span className="lp-grid-name">{img.filename.replace(/\.[^.]+$/, '')}</span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
 *  主组件
 * ───────────────────────────────────────── */
export function LandingPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [view, setView] = useState<'3d' | 'grid'>('3d');
  const [tagFilter, setTagFilter] = useState<string | undefined>();

  const { data: imageData, isLoading } = useQuery({
    queryKey: ['public-images-landing', tagFilter],
    queryFn: () => imagesAPI.listPublic({ page: 1, limit: 40, tag: tagFilter }),
  });

  const { data: tagData } = useQuery({
    queryKey: ['public-tags'],
    queryFn: () => tagsAPI.list(),
  });

  const images = imageData?.data?.data?.items ?? [];
  const total  = imageData?.data?.data?.total ?? 0;
  const tags   = tagData?.data?.data?.items ?? [];

  const handlePick = (id: number) => {
    navigate(isAuthenticated ? `/gallery/${id}` : '/login');
  };

  return (
    <>
      <style>{landingCSS}</style>

      <motion.div
        className="lp-root paper-grain"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: ease.out as any }}
      >
        {/* ── 顶部导航（玻璃质感）── */}
        <motion.nav
          className="lp-nav"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <a className="lp-logo" href="/" data-cursor="hover">
            赤子の相册
            <span className="lp-logo-sub">chizi album</span>
          </a>
          <div className="lp-nav-actions">
            {isAuthenticated ? (
              <motion.button
                className="lp-btn-solid"
                onClick={() => navigate('/gallery')}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.soft}
                data-cursor="hover"
              >
                进入图库
              </motion.button>
            ) : (
              <>
                <motion.button
                  className="lp-btn-ghost"
                  onClick={() => navigate('/login')}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring.soft}
                  data-cursor="hover"
                >
                  登录
                </motion.button>
                <motion.button
                  className="lp-btn-solid"
                  onClick={() => navigate('/register')}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring.soft}
                  data-cursor="hover"
                >
                  注册
                </motion.button>
              </>
            )}
          </div>
        </motion.nav>

        {/* ── Hero 文案（绝对定位浮在 3D 之上）── */}
        <motion.div
          className="lp-hero"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.p className="lp-kana" variants={staggerItem}>
            赤 子 剧 社 · 影 像 存 档
          </motion.p>
          <motion.h1 className="lp-title" variants={staggerItem}>
            每一帧，<br />
            都是<em>赤诚</em>的<br />
            留白。
          </motion.h1>
          <motion.p className="lp-desc" variants={staggerItem}>
            悬浮的影像里，<br />
            藏着排练的汗、谢幕的灯，<br />
            和那些没说出口的话。
          </motion.p>
        </motion.div>

        {/* ── 右上角总数 ── */}
        <motion.div
          className="lp-count-block"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: ease.out as any }}
        >
          <div className="lp-count">{total > 0 ? total : '—'}</div>
          <div className="lp-count-label">张影像 · 公开存档</div>
        </motion.div>

        {/* ── 3D 场景 / 2D 网格 ── */}
        <div className="lp-stage">
          <AnimatePresence mode="wait">
            {view === '3d' && (
              <motion.div
                key="3d"
                className="lp-canvas-wrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: ease.out as any }}
              >
                {!isLoading && images.length > 0 && (
                  <Canvas
                    key={images.map((i: any) => i.id).join(',')}
                    camera={{ position: [0, 0, 10], fov: 50 }}
                    dpr={[1, 2]}
                    gl={{ antialias: true, alpha: true }}
                  >
                    <Suspense fallback={null}>
                      <Scene images={images} onPick={handlePick} />
                    </Suspense>
                  </Canvas>
                )}
              </motion.div>
            )}

            {view === 'grid' && (
              <motion.div
                key="grid"
                className="lp-grid-wrap"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: ease.out as any }}
              >
                <GridView images={images} onPick={handlePick} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── 底部控制栏（玻璃 + 视图切换 + 标签）── */}
        <motion.div
          className="lp-controls"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6, ease: ease.out as any }}
        >
          {/* 视图切换 */}
          <div className="lp-view-switch">
            <motion.div
              className="lp-view-pill"
              animate={{ x: view === '3d' ? 0 : 64 }}
              transition={spring.default}
            />
            <button
              className={`lp-view-btn ${view === '3d' ? 'on' : ''}`}
              onClick={() => setView('3d')}
              data-cursor="hover"
            >
              ◐ 3D
            </button>
            <button
              className={`lp-view-btn ${view === 'grid' ? 'on' : ''}`}
              onClick={() => setView('grid')}
              data-cursor="hover"
            >
              ◫ grid
            </button>
          </div>

          {/* 标签过滤 */}
          <div className="lp-tags">
            {tags.slice(0, 6).map((t: any) => (
              <motion.button
                key={t.id}
                className={`lp-tag ${tagFilter === t.name ? 'on' : ''}`}
                onClick={() => setTagFilter(prev => prev === t.name ? undefined : t.name)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={spring.soft}
                data-cursor="hover"
              >
                {t.name}
              </motion.button>
            ))}
          </div>

          {/* 提示 */}
          {view === '3d' && (
            <motion.span
              className="lp-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              ↻ drag to rotate · scroll to zoom
            </motion.span>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}

/* ─── 内联 CSS（仅本页用）─── */
const landingCSS = `
.lp-root {
  position: relative;
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--ink-1);
  font-family: var(--font-sans);
  overflow: hidden;
}

/* ── nav ── */
.lp-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 48px;
  background: rgba(248, 245, 240, 0.7);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-bottom: 1px solid var(--line-3);
}
.lp-logo {
  font-family: var(--font-mincho);
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0.06em;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.lp-logo-sub {
  font-family: var(--font-garamond);
  font-size: 12px;
  font-style: italic;
  color: var(--ink-4);
  letter-spacing: 0.12em;
}
.lp-nav-actions { display: flex; gap: 10px; }
.lp-btn-ghost, .lp-btn-solid {
  padding: 8px 20px;
  font-size: 13px;
  letter-spacing: 0.04em;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  border: 1px solid var(--ink-1);
  transition: background-color var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out);
}
.lp-btn-ghost { background: none; color: var(--ink-1); }
.lp-btn-solid { background: var(--ink-1); color: var(--bg-primary); }
.lp-btn-ghost:hover { background: var(--ink-1); color: var(--bg-primary); }
.lp-btn-solid:hover { background: var(--gold); border-color: var(--gold); }

/* ── hero ── */
.lp-hero {
  position: absolute;
  left: 48px;
  top: 120px;
  z-index: 5;
  max-width: 360px;
  pointer-events: none;
}
.lp-hero > * { pointer-events: auto; }
.lp-kana {
  font-family: var(--font-mincho);
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--gold);
  margin-bottom: 16px;
}
.lp-title {
  font-family: var(--font-mincho);
  font-size: clamp(38px, 4.5vw, 64px);
  font-weight: 500;
  line-height: 1.15;
  margin-bottom: 24px;
}
.lp-title em {
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--gold);
}
.lp-desc {
  font-size: 13px;
  font-weight: 300;
  line-height: 2;
  color: var(--ink-3);
}

/* ── count ── */
.lp-count-block {
  position: absolute;
  right: 48px;
  top: 110px;
  z-index: 5;
  text-align: right;
  pointer-events: none;
}
.lp-count {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 96px;
  color: rgba(44, 42, 39, 0.08);
  line-height: 1;
}
.lp-count-label {
  font-size: 11px;
  letter-spacing: 0.25em;
  color: var(--ink-4);
}

/* ── 3d stage ── */
.lp-stage {
  position: absolute;
  inset: 0;
  z-index: 2;
}
.lp-canvas-wrap {
  position: absolute;
  inset: 0;
}
.lp-canvas-wrap canvas {
  width: 100% !important;
  height: 100% !important;
}

/* ── 2d grid ── */
.lp-grid-wrap {
  position: absolute;
  inset: 200px 48px 120px;
  overflow-y: auto;
}
.lp-grid-2d {
  columns: 4 220px;
  column-gap: 16px;
}
.lp-grid-card {
  break-inside: avoid;
  margin-bottom: 16px;
  cursor: pointer;
  position: relative;
}
.lp-grid-card img {
  width: 100%;
  display: block;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
}
.lp-grid-meta {
  padding: 8px 2px 4px;
  font-size: 11px;
  color: var(--ink-3);
}
.lp-grid-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── controls ── */
.lp-controls {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px 8px 8px;
  background: rgba(248, 245, 240, 0.7);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid var(--line-3);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-lg);
}

.lp-view-switch {
  position: relative;
  display: flex;
  background: var(--line-4);
  border-radius: var(--radius-full);
  padding: 3px;
}
.lp-view-pill {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 60px;
  height: calc(100% - 6px);
  background: var(--ink-1);
  border-radius: var(--radius-full);
  z-index: 0;
}
.lp-view-btn {
  position: relative;
  z-index: 1;
  padding: 5px 14px;
  font-family: var(--font-garamond);
  font-size: 12px;
  font-style: italic;
  letter-spacing: 0.06em;
  background: none;
  border: none;
  color: var(--ink-3);
  transition: color var(--dur-fast) var(--ease-out);
}
.lp-view-btn.on { color: var(--bg-primary); }

.lp-tags {
  display: flex;
  gap: 6px;
}
.lp-tag {
  font-size: 11px;
  padding: 4px 12px;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-full);
  background: none;
  color: var(--ink-3);
  font-family: var(--font-sans);
  transition: background-color var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out);
}
.lp-tag.on {
  background: var(--ink-1);
  color: var(--bg-primary);
  border-color: var(--ink-1);
}

.lp-hint {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: var(--ink-4);
  letter-spacing: 0.06em;
  padding-left: 8px;
  border-left: 1px solid var(--line-2);
}
`;
