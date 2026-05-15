/**
 * 赤子の相册 · Image Detail Page
 * 风格：Japandi 暖米白 + 枯叶金 accent
 *
 * 核心交互：
 *   - 左侧大图：点击整张图 3D 翻转（CSS perspective），背面展示 EXIF 元数据
 *   - 共享 layoutId：从 Gallery 飞入过渡（framer-motion layout）
 *   - 鼠标在图片上移动时：图片随视差轻微倾斜（max ±6deg，Apple 风格）
 *   - 右侧信息面板：
 *       · 文件名 / 尺寸 / 类型 / 日期
 *       · 上传者卡片
 *       · 标签：点击切换，激活时金色 ring 扩散动效
 *       · 提取主色板（canvas 采样）
 *       · 浏览数 / 文件大小统计
 *       · 下载 / 复制链接 / 删除
 *   - 键盘：← → 切换上一张/下一张（从 Gallery 列表缓存取）
 *   - 顶部面包屑 + 前后导航箭头
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Popconfirm, Select } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';

import { imagesAPI } from '../../api/images';
import { tagsAPI } from '../../api/tags';
import { useAuthStore } from '../../store/authStore';
import { formatFileSize, formatDateTime } from '../../utils/format';
import { spring, ease, fadeUp, staggerContainer, staggerItem } from '../../utils/motion';

/* ─── 主色提取 ─── */
function extractColors(img: HTMLImageElement, count = 5): string[] {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, 80, 60);
    const data = ctx.getImageData(0, 0, 80, 60).data;
    const colors: string[] = [];
    const step = Math.floor(data.length / 4 / count);
    for (let i = 0; i < count; i++) {
      const idx = i * step * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      colors.push(`rgb(${r},${g},${b})`);
    }
    return colors;
  } catch {
    return [];
  }
}

/* ─────────────────────────────────────────
 *  3D 翻转图片卡片
 * ───────────────────────────────────────── */
function FlipCard({ img, onColorExtract }: {
  img: any;
  onColorExtract: (colors: string[]) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  /* 视差倾斜 */
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (flipped) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: -dy * 5, y: dx * 5 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  /* 主色提取 */
  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const colors = extractColors(e.currentTarget);
    if (colors.length) onColorExtract(colors);
  };

  const exifItems = img ? [
    { k: 'Filename',   v: img.filename },
    { k: 'Dimensions', v: img.width && img.height ? `${img.width} × ${img.height}` : '—' },
    { k: 'File size',  v: formatFileSize(img.file_size) },
    { k: 'Type',       v: img.mime_type },
    { k: 'Uploaded',   v: formatDateTime(img.created_at) },
    { k: 'Views',      v: img.view_count ?? 0 },
  ] : [];

  return (
    <div
      ref={cardRef}
      className="dp-flip-scene"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => setFlipped(f => !f)}
      data-cursor="hover"
    >
      <motion.div
        className="dp-flip-card"
        animate={{
          rotateY: flipped ? 180 : 0,
          rotateX: flipped ? 0 : tilt.x,
          rotateZ: flipped ? 0 : 0,
          // subtle tilt only when not flipped
          ...(flipped ? {} : { rotateX: tilt.x, rotateY: tilt.y }),
        }}
        transition={flipped
          ? { type: 'spring', stiffness: 220, damping: 28 }
          : { type: 'spring', stiffness: 400, damping: 40, mass: 0.5 }
        }
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* 正面：图片 */}
        <div className="dp-flip-face dp-flip-front">
          <motion.img
            className="dp-img"
            src={img?.url}
            alt={img?.alt_text || img?.filename}
            layoutId={`image-img-${img?.id}`}
            onLoad={handleImgLoad}
            crossOrigin="anonymous"
          />
          <div className="dp-flip-hint">
            <span>↻</span> click to flip · 翻面查看元数据
          </div>
        </div>

        {/* 背面：EXIF */}
        <div className="dp-flip-face dp-flip-back">
          <div className="dp-exif-title">METADATA · 元 数 据</div>
          <div className="dp-exif-grid">
            {exifItems.map(({ k, v }) => (
              <div key={k} className="dp-exif-row">
                <span className="dp-exif-k">{k}</span>
                <span className="dp-exif-v">{String(v)}</span>
              </div>
            ))}
          </div>
          <div className="dp-flip-hint dp-flip-hint-back">
            ↺ click to flip back
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────
 *  标签按钮（带 ring 动效）
 * ───────────────────────────────────────── */
function TagButton({ tag, active, count, onToggle }: {
  tag: any;
  active: boolean;
  count: number;
  onToggle: () => void;
}) {
  const [ripple, setRipple] = useState(false);

  const handleClick = () => {
    onToggle();
    setRipple(true);
    setTimeout(() => setRipple(false), 600);
  };

  return (
    <motion.button
      className={`dp-tag ${active ? 'on' : ''}`}
      onClick={handleClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.95 }}
      transition={spring.soft}
      data-cursor="hover"
    >
      {active && <span className="dp-tag-check">✓</span>}
      {tag.name}
      {count > 0 && <span className="dp-tag-count">{count}</span>}
      {ripple && <span className="dp-tag-ring" />}
    </motion.button>
  );
}

/* ─────────────────────────────────────────
 *  主页面
 * ───────────────────────────────────────── */
export function ImageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [colors, setColors] = useState<string[]>([]);

  /* 数据 */
  const { data, isLoading } = useQuery({
    queryKey: ['image', id],
    queryFn: () => imagesAPI.get(Number(id)),
    enabled: !!id,
  });

  const { data: tagData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
  });

  const img = data?.data?.data;
  const availableTags = tagData?.data?.data?.items ?? [];

  /* Mutations */
  const toggleMutation = useMutation({
    mutationFn: (tagId: number) => imagesAPI.toggleTag(Number(id), tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['image', id] }),
  });

  const addTagMutation = useMutation({
    mutationFn: (tagNames: string[]) => imagesAPI.addTags(Number(id), tagNames),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image', id] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      message.success('标签已添加');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => imagesAPI.delete(Number(id)),
    onSuccess: () => {
      message.success('已删除');
      navigate('/gallery');
    },
  });

  /* 键盘导航 */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'Escape') navigate('/gallery');
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /* 复制链接 */
  const handleCopy = () => {
    if (img?.url) {
      navigator.clipboard.writeText(img.url);
      message.success('链接已复制');
    }
  };

  if (isLoading) {
    return (
      <div className="dp-loading">
        <motion.div
          className="dp-loading-mark"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >○</motion.div>
      </div>
    );
  }

  if (!img) return null;

  return (
    <>
      <style>{detailCSS}</style>

      <motion.div
        className="dp-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: ease.out as any }}
      >
        {/* ── 顶部 bar ── */}
        <motion.div
          className="dp-topbar"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <div className="dp-bc">
            <button className="dp-bc-link" onClick={() => navigate('/gallery')} data-cursor="hover">
              赤子の相册
            </button>
            <span className="dp-bc-sep">／</span>
            <button className="dp-bc-link" onClick={() => navigate('/gallery')} data-cursor="hover">
              全部影像
            </button>
            <span className="dp-bc-sep">／</span>
            <span className="dp-bc-cur">{img.filename}</span>
          </div>

          <div className="dp-top-actions">
            <motion.button
              className="dp-icon-btn"
              onClick={() => navigate('/gallery')}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.95 }}
              transition={spring.soft}
              data-cursor="hover"
              title="返回"
            >←</motion.button>
            <motion.button
              className="dp-icon-btn"
              onClick={handleCopy}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.95 }}
              transition={spring.soft}
              data-cursor="hover"
              title="复制链接"
            >↗</motion.button>
            <Popconfirm title="确认删除这张图片？" onConfirm={() => deleteMutation.mutate()}>
              <motion.button
                className="dp-icon-btn dp-icon-danger"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.95 }}
                transition={spring.soft}
                data-cursor="hover"
                title="删除"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                </svg>
              </motion.button>
            </Popconfirm>
          </div>
        </motion.div>

        {/* ── 主内容：左图 右信息 ── */}
        <div className="dp-main">
          {/* 左：图片 3D 翻转 */}
          <motion.div
            className="dp-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: ease.out as any }}
          >
            <FlipCard img={img} onColorExtract={setColors} />
          </motion.div>

          {/* 右：信息面板 */}
          <motion.div
            className="dp-right"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* 标题 */}
            <motion.div variants={staggerItem}>
              <p className="dp-kana">影 像 · 档 案</p>
              <h1 className="dp-filename">{img.filename.replace(/\.[^.]+$/, '')}</h1>
              <div className="dp-sub-meta">
                {img.width && img.height && <span>{img.width} × {img.height}</span>}
                <span>·</span>
                <span>{formatFileSize(img.file_size)}</span>
                <span>·</span>
                <span>{img.mime_type?.split('/')[1]?.toUpperCase()}</span>
              </div>
            </motion.div>

            {/* 上传者 */}
            <motion.div className="dp-uploader" variants={staggerItem}>
              <div className="dp-avatar">{(img.username || user?.username || '?')[0]}</div>
              <div>
                <div className="dp-up-name">{img.username || user?.username}</div>
                <div className="dp-up-time">{formatDateTime(img.created_at)}</div>
              </div>
            </motion.div>

            {/* 标签 */}
            <motion.div variants={staggerItem}>
              <div className="dp-sec-header">
                <span>TAGS</span>
                <em>点击切换</em>
              </div>
              <div className="dp-tags">
                {availableTags.map((t: any) => {
                  const imgTag = img.tags?.find((it: any) => it.id === t.id);
                  return (
                    <TagButton
                      key={t.id}
                      tag={t}
                      active={imgTag?.active ?? false}
                      count={imgTag?.count ?? 0}
                      onToggle={() => toggleMutation.mutate(t.id)}
                    />
                  );
                })}
                <Select
                  mode="tags"
                  placeholder="+ 自定义"
                  className="dp-tag-input"
                  onChange={(vals) => {
                    if ((vals as string[]).length > 0) addTagMutation.mutate(vals as string[]);
                  }}
                  value={[]}
                  notFoundContent={null}
                />
              </div>
            </motion.div>

            {/* 主色板 */}
            <AnimatePresence>
              {colors.length > 0 && (
                <motion.div
                  variants={staggerItem}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="dp-sec-header">
                    <span>PALETTE</span>
                    <em>extracted colors</em>
                  </div>
                  <div className="dp-palette">
                    {colors.map((c, i) => (
                      <motion.div
                        key={i}
                        className="dp-swatch"
                        style={{ background: c }}
                        whileHover={{ flex: 2.5 }}
                        transition={spring.soft}
                        onClick={() => {
                          navigator.clipboard.writeText(c);
                          message.success(`已复制 ${c}`);
                        }}
                        data-cursor="hover"
                        title={c}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 统计 */}
            <motion.div className="dp-stats" variants={staggerItem}>
              <div className="dp-stat">
                <div className="dp-stat-n">{img.view_count ?? 0}</div>
                <div className="dp-stat-l">VIEWS</div>
              </div>
              <div className="dp-stat">
                <div className="dp-stat-n">{img.tags?.filter((t: any) => t.active)?.length ?? 0}</div>
                <div className="dp-stat-l">TAGS</div>
              </div>
              <div className="dp-stat">
                <div className="dp-stat-n">{formatFileSize(img.file_size).split(' ')[0]}</div>
                <div className="dp-stat-l">{formatFileSize(img.file_size).split(' ')[1]}</div>
              </div>
            </motion.div>

            {/* 操作按钮 */}
            <motion.div className="dp-actions" variants={staggerItem}>
              <motion.a
                className="dp-btn-primary"
                href={img.download_url || img.url}
                target="_blank"
                rel="noreferrer"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.soft}
                data-cursor="hover"
              >
                ↓ 下载原图
              </motion.a>
              <motion.button
                className="dp-btn-secondary"
                onClick={handleCopy}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.soft}
                data-cursor="hover"
              >
                复制链接
              </motion.button>
            </motion.div>

            {/* 键盘提示 */}
            <motion.div className="dp-keyboard-hint" variants={staggerItem}>
              <kbd>←</kbd> 返回 &nbsp;·&nbsp; <kbd>Esc</kbd> 图库
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

/* ─── CSS ─── */
const detailCSS = `
.dp-root {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--ink-1);
  font-family: var(--font-sans);
}

/* ── loading ── */
.dp-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dp-loading-mark {
  font-family: var(--font-mincho);
  font-size: 48px;
  color: var(--ink-5);
}

/* ── top bar ── */
.dp-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 40px;
  border-bottom: 1px solid var(--line-3);
  background: rgba(248, 245, 240, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.dp-bc {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--ink-4);
}
.dp-bc-link {
  background: none;
  border: none;
  color: var(--ink-3);
  font-size: 11px;
  font-family: var(--font-sans);
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: color var(--dur-fast) var(--ease-out);
}
.dp-bc-link:hover { color: var(--ink-1); }
.dp-bc-sep { color: var(--ink-5); }
.dp-bc-cur {
  color: var(--ink-1);
  font-family: var(--font-garamond);
  font-style: italic;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dp-top-actions {
  display: flex;
  gap: 6px;
}
.dp-icon-btn {
  width: 32px;
  height: 32px;
  background: none;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  color: var(--ink-3);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--dur-fast) var(--ease-out);
}
.dp-icon-btn:hover {
  background: var(--ink-1);
  color: var(--bg-primary);
  border-color: var(--ink-1);
}
.dp-icon-danger:hover {
  background: #a83a30;
  border-color: #a83a30;
}

/* ── main layout ── */
.dp-main {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 48px;
  padding: 40px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
  align-items: start;
}

/* ── left: 3D flip card ── */
.dp-left {
  position: sticky;
  top: 80px;
}
.dp-flip-scene {
  perspective: 1400px;
  cursor: pointer;
}
.dp-flip-card {
  width: 100%;
  position: relative;
  transform-style: preserve-3d;
  will-change: transform;
}
.dp-flip-face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: var(--radius-md);
  overflow: hidden;
}
.dp-flip-front {
  position: relative;
}
.dp-flip-back {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
  background: var(--ink-1);
  color: var(--bg-primary);
  padding: 36px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.dp-img {
  width: 100%;
  display: block;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2xl);
}
.dp-flip-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: rgba(248, 245, 240, 0.85);
  background: rgba(44, 42, 39, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 5px 14px;
  border-radius: var(--radius-full);
  white-space: nowrap;
  letter-spacing: 0.04em;
  pointer-events: none;
}
.dp-flip-hint-back {
  position: static;
  transform: none;
  background: rgba(248, 245, 240, 0.1);
  color: rgba(248, 245, 240, 0.6);
  margin-top: 24px;
  display: inline-block;
  align-self: flex-start;
}

/* EXIF back */
.dp-exif-title {
  font-family: var(--font-mincho);
  font-size: 10px;
  letter-spacing: 0.28em;
  color: var(--gold);
  margin-bottom: 20px;
}
.dp-exif-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dp-exif-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  border-bottom: 1px solid rgba(248, 245, 240, 0.08);
  padding-bottom: 10px;
  font-size: 12px;
}
.dp-exif-k {
  color: rgba(248, 245, 240, 0.5);
  letter-spacing: 0.06em;
  flex-shrink: 0;
}
.dp-exif-v {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 14px;
  color: var(--bg-primary);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

/* ── right: info ── */
.dp-right {
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.dp-kana {
  font-family: var(--font-mincho);
  font-size: 10px;
  letter-spacing: 0.3em;
  color: var(--gold);
  margin-bottom: 8px;
}
.dp-filename {
  font-family: var(--font-mincho);
  font-size: clamp(20px, 2.5vw, 28px);
  line-height: 1.3;
  word-break: break-all;
  margin-bottom: 8px;
}
.dp-sub-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--ink-4);
  font-family: var(--font-garamond);
  font-style: italic;
}

/* 上传者 */
.dp-uploader {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--line-3);
  border-bottom: 1px solid var(--line-3);
}
.dp-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--gold);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mincho);
  font-size: 16px;
  text-transform: uppercase;
  flex-shrink: 0;
}
.dp-up-name { font-size: 13px; font-weight: 500; }
.dp-up-time {
  font-size: 11px;
  color: var(--ink-4);
  font-family: var(--font-garamond);
  font-style: italic;
  margin-top: 2px;
}

/* section header */
.dp-sec-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
  font-size: 9px;
  letter-spacing: 0.22em;
  color: var(--ink-5);
  text-transform: uppercase;
  font-family: var(--font-garamond);
}
.dp-sec-header em {
  font-style: italic;
  text-transform: none;
  letter-spacing: 0.04em;
  color: var(--ink-4);
  font-size: 10px;
}

/* tags */
.dp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
}
.dp-tag {
  position: relative;
  font-size: 12px;
  padding: 5px 13px;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-full);
  background: none;
  color: var(--ink-3);
  font-family: var(--font-sans);
  overflow: hidden;
  transition: border-color var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out),
              background var(--dur-fast) var(--ease-out);
}
.dp-tag:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.dp-tag.on {
  background: var(--ink-1);
  color: var(--bg-primary);
  border-color: var(--ink-1);
  padding-left: 24px;
}
.dp-tag-check {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 9px;
  color: var(--gold);
}
.dp-tag-count {
  margin-left: 5px;
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  opacity: 0.7;
}
.dp-tag-ring {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-full);
  border: 1px solid var(--gold);
  animation: dp-ring 0.6s ease-out forwards;
  pointer-events: none;
}
@keyframes dp-ring {
  0%   { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
}
.dp-tag-input {
  min-width: 100px;
  font-size: 11px;
}
.dp-tag-input .ant-select-selector {
  border: 1px solid var(--line-2) !important;
  border-radius: var(--radius-full) !important;
  background: none !important;
  font-family: var(--font-sans) !important;
  font-size: 11px !important;
  min-height: 32px !important;
  padding: 2px 12px !important;
}

/* palette */
.dp-palette {
  display: flex;
  height: 28px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  gap: 1px;
}
.dp-swatch {
  flex: 1;
  cursor: pointer;
  transition: flex var(--dur-normal) var(--ease-out);
}

/* stats */
.dp-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--line-3);
  padding-top: 16px;
}
.dp-stat { text-align: center; }
.dp-stat-n {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 26px;
  line-height: 1;
  margin-bottom: 4px;
}
.dp-stat-l {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--ink-4);
  text-transform: uppercase;
  font-family: var(--font-garamond);
}

/* actions */
.dp-actions {
  display: flex;
  gap: 10px;
}
.dp-btn-primary {
  flex: 1;
  background: var(--ink-1);
  color: var(--bg-primary);
  border: none;
  padding: 12px;
  font-size: 12px;
  letter-spacing: 0.1em;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  text-align: center;
  text-decoration: none;
  display: block;
  transition: background var(--dur-fast) var(--ease-out);
}
.dp-btn-primary:hover {
  background: var(--gold);
  color: #fff;
}
.dp-btn-secondary {
  background: none;
  color: var(--ink-1);
  border: 1px solid var(--line-2);
  padding: 12px 18px;
  font-size: 12px;
  letter-spacing: 0.06em;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  transition: all var(--dur-fast) var(--ease-out);
}
.dp-btn-secondary:hover {
  background: var(--ink-1);
  color: var(--bg-primary);
  border-color: var(--ink-1);
}

/* keyboard hint */
.dp-keyboard-hint {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: var(--ink-5);
  letter-spacing: 0.04em;
}
kbd {
  display: inline-block;
  padding: 1px 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  font-style: normal;
  color: var(--ink-3);
}

/* responsive */
@media (max-width: 900px) {
  .dp-main {
    grid-template-columns: 1fr;
    padding: 20px;
    gap: 28px;
  }
  .dp-left { position: static; }
  .dp-topbar { padding: 14px 20px; }
}
`;
