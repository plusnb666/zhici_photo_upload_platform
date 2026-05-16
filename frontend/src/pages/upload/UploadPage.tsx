/**
 * 赤子の相册 · Upload Page
 * 风格：Japandi 暖米白 + 苔绿 accent（生长感）
 *
 * 核心交互：
 *   - 左侧大 drop zone：拖入时边框金色脉冲 + SVG 漏斗图标粒子持续掉落
 *   - 文件拖入瞬间：逐个卡片弹入右侧队列（stagger spring）
 *   - 每张文件卡片：缩略图预览 + 文件名 + 大小 + 实时进度条
 *   - 上传中：进度条苔绿色填充 + 发光圆点指示 + 百分比数字
 *   - 完成：✓ 绿色状态 + 卡片轻微缩放确认
 *   - 错误（超大文件）：红色描边 + 摇动动画
 *   - 顶部总进度：深色卡片 + 圆形进度环 + "X / Y 张"
 *   - 标签预设：可一键给所有文件批量打标签
 *   - 上传完成后 2 秒自动跳转图库
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { message, Select } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';

import { imagesAPI } from '../../api/images';
import { tagsAPI } from '../../api/tags';
import { formatFileSize } from '../../utils/format';
import { ALLOWED_IMAGE_TYPES, UPLOAD_MAX_SIZE_BYTES } from '../../utils/constants';
import { spring, ease, staggerContainer, staggerItem } from '../../utils/motion';

/* ─── 文件条目 ─── */
interface FileEntry {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  errorMsg?: string;
}

/* ─── 粒子漏斗图标 ─── */
function FunnelIcon({ active }: { active: boolean }) {
  return (
    <div className="up-funnel">
      <svg className="up-funnel-svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 12h48l-18 22v22l-12-6V34L8 12z" strokeLinejoin="round" />
      </svg>
      <AnimatePresence>
        {active && (
          <>
            {[14, 28, 42].map((x, i) => (
              <motion.div
                key={i}
                className="up-particle"
                style={{ left: x }}
                initial={{ top: -8, opacity: 0, scale: 0 }}
                animate={{ top: 56, opacity: [0, 1, 1, 0], scale: [0, 1, 0.8, 0.3] }}
                transition={{
                  duration: 1.4,
                  delay: i * 0.3,
                  repeat: Infinity,
                  ease: 'easeIn',
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── 圆形进度环 ─── */
function CircleProgress({ value, total }: { value: number; total: number }) {
  const pct = total === 0 ? 0 : value / total;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);

  return (
    <div className="up-circle-wrap">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(248,245,240,0.1)" strokeWidth="6" />
        <motion.circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke="#7a9b58"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: dash }}
          transition={{ duration: 0.6, ease: ease.out as any }}
          style={{ rotate: -90, transformOrigin: '48px 48px' }}
        />
      </svg>
      <div className="up-circle-text">
        <span className="up-circle-val">{value}</span>
        <span className="up-circle-total">/{total}</span>
      </div>
    </div>
  );
}

/* ─── 文件队列卡片 ─── */
function FileCard({
  entry,
  onRemove,
}: {
  entry: FileEntry;
  onRemove: (id: string) => void;
}) {
  const shake = entry.status === 'error';

  return (
    <motion.div
      className={`up-file-card ${entry.status}`}
      variants={staggerItem}
      layout
      animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : {}}
      transition={shake ? { duration: 0.4, ease: 'easeInOut' } : spring.soft}
    >
      {/* 缩略图 */}
      <div className="up-thumb">
        <img src={entry.preview} alt={entry.file.name} />
      </div>

      {/* 文件信息 */}
      <div className="up-file-info">
        <div className="up-file-name" title={entry.file.name}>
          {entry.file.name}
        </div>
        <div className="up-file-size">{formatFileSize(entry.file.size)}</div>

        {/* 进度条 */}
        {entry.status === 'uploading' && (
          <div className="up-prog-wrap">
            <div className="up-prog-bg">
              <motion.div
                className="up-prog-bar"
                animate={{ width: `${entry.progress}%` }}
                transition={{ duration: 0.3, ease: ease.out as any }}
              >
                <span className="up-prog-dot" />
              </motion.div>
            </div>
            <span className="up-prog-pct">{entry.progress}%</span>
          </div>
        )}

        {entry.status === 'done' && (
          <div className="up-status-done">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={spring.soft}
            >✓</motion.span>
            done
          </div>
        )}

        {entry.status === 'error' && (
          <div className="up-status-err">⚠ {entry.errorMsg}</div>
        )}
      </div>

      {/* 移除按钮 */}
      {(entry.status === 'pending' || entry.status === 'error') && (
        <motion.button
          className="up-remove-btn"
          onClick={() => onRemove(entry.id)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          data-cursor="hover"
        >✕</motion.button>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
 *  主页面
 * ───────────────────────────────────────── */
export function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dropRef = useRef<HTMLDivElement>(null);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  const { data: tagData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
  });
  const availableTags = tagData?.data?.data?.items ?? [];

  /* 生成预览 */
  const makeEntry = (file: File): FileEntry => {
    const isOk = ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= UPLOAD_MAX_SIZE_BYTES;
    return {
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      status: isOk ? 'pending' : 'error',
      progress: 0,
      errorMsg: !ALLOWED_IMAGE_TYPES.includes(file.type)
        ? '不支持的格式'
        : '超过大小限制',
    };
  };

  /* 添加文件 */
  const addFiles = useCallback((incoming: File[]) => {
    const entries = incoming.map(makeEntry);
    setFiles(prev => {
      const existing = new Set(prev.map(e => e.file.name + e.file.size));
      return [...prev, ...entries.filter(e => !existing.has(e.file.name + e.file.size))];
    });
  }, []);

  /* drop zone 拖拽 */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  };

  /* 文件选择器 */
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  /* 移除 */
  const removeFile = (id: string) => {
    setFiles(prev => {
      const entry = prev.find(e => e.id === id);
      if (entry) URL.revokeObjectURL(entry.preview);
      return prev.filter(e => e.id !== id);
    });
  };

  /* 上传（逐个，带进度模拟） */
  const handleUpload = async () => {
    const pending = files.filter(e => e.status === 'pending');
    if (pending.length === 0) return;

    setUploading(true);
    setDoneCount(0);
    let done = 0;

    for (const entry of pending) {
      /* 更新状态为 uploading */
      setFiles(prev => prev.map(e =>
        e.id === entry.id ? { ...e, status: 'uploading', progress: 0 } : e
      ));

      /* 进度模拟（真实 XHR progress 需要 axios onUploadProgress）*/
      const ticker = setInterval(() => {
        setFiles(prev => prev.map(e =>
          e.id === entry.id && e.progress < 85
            ? { ...e, progress: e.progress + Math.random() * 18 }
            : e
        ));
      }, 200);

      try {
        const formData = new FormData();
        formData.append('files', entry.file);
        if (tags.length > 0) formData.append('tags', JSON.stringify(tags));
        await imagesAPI.upload(formData);

        clearInterval(ticker);
        setFiles(prev => prev.map(e =>
          e.id === entry.id ? { ...e, status: 'done', progress: 100 } : e
        ));
        done++;
        setDoneCount(done);
      } catch (err: any) {
        clearInterval(ticker);
        setFiles(prev => prev.map(e =>
          e.id === entry.id
            ? { ...e, status: 'error', errorMsg: err.response?.data?.message || '上传失败' }
            : e
        ));
      }
    }

    setUploading(false);
    queryClient.invalidateQueries({ queryKey: ['images'] });

    if (done > 0) {
      message.success(`${done} 张上传成功，即将跳转图库…`);
      setTimeout(() => navigate('/gallery'), 2000);
    }
  };

  const pendingCount = files.filter(e => e.status === 'pending').length;
  const totalValid = files.filter(e => e.status !== 'error').length;

  return (
    <>
      <style>{uploadCSS}</style>

      <motion.div
        className="up-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: ease.out as any }}
      >
        <div className="up-layout">

          {/* ── 左：drop zone ── */}
          <motion.div
            ref={dropRef}
            className={`up-dz ${dragging ? 'active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: ease.out as any }}
            data-cursor="hover"
          >
            <FunnelIcon active={dragging} />

            <p className="up-dz-kana">投 · 影</p>
            <h2 className="up-dz-title">
              把影像，<em>放</em>进这里
            </h2>
            <p className="up-dz-sub">
              拖拽图片到此区域<br />
              或
            </p>
            <p className="up-dz-dots">· · ·</p>

            <label className="up-dz-btn" data-cursor="hover">
              选择文件
              <input
                type="file"
                multiple
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
            </label>

            <div className="up-dz-formats">
              <span>PNG · JPG · WEBP · GIF · BMP</span>
              <span>·</span>
              <span>≤ 1GB / 张</span>
            </div>

            {/* 拖拽时脉冲边框 */}
            <AnimatePresence>
              {dragging && (
                <motion.div
                  className="up-dz-pulse"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={spring.soft}
                />
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── 右：队列 ── */}
          <motion.div
            className="up-queue"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: ease.out as any }}
          >
            {/* 队列顶部 */}
            <div className="up-q-head">
              <div>
                <span className="up-q-title">上传队列</span>
                {files.length > 0 && (
                  <em className="up-q-sub"> · {files.length} 个文件</em>
                )}
              </div>
              {files.length > 0 && (
                <button
                  className="up-q-clear"
                  onClick={() => setFiles([])}
                  data-cursor="hover"
                >全部清除</button>
              )}
            </div>

            {/* 总进度卡片 */}
            <AnimatePresence>
              {uploading && (
                <motion.div
                  className="up-total-card"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={spring.soft}
                >
                  <CircleProgress value={doneCount} total={totalValid} />
                  <div className="up-total-info">
                    <div className="up-total-label">UPLOADING</div>
                    <div className="up-total-detail">
                      {doneCount} / {totalValid} 张完成
                    </div>
                    <div className="up-total-bar-bg">
                      <motion.div
                        className="up-total-bar"
                        animate={{ width: totalValid ? `${(doneCount / totalValid) * 100}%` : '0%' }}
                        transition={{ duration: 0.4, ease: ease.out as any }}
                      >
                        <span className="up-total-dot" />
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 标签预设 */}
            <div className="up-preset">
              <div className="up-preset-label">批量打标签</div>
              <div className="up-preset-tags">
                {availableTags.slice(0, 6).map((t: any) => (
                  <motion.button
                    key={t.id}
                    className={`up-preset-tag ${tags.includes(t.name) ? 'on' : ''}`}
                    onClick={() => setTags(prev =>
                      prev.includes(t.name) ? prev.filter(x => x !== t.name) : [...prev, t.name]
                    )}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={spring.soft}
                    data-cursor="hover"
                  >{t.name}</motion.button>
                ))}
                <Select
  mode="tags"
  placeholder="+ 自定义"
  value={tags}
  onChange={setTags}
  className="up-tag-select"
  notFoundContent={null}
  options={availableTags.map((t: any) => ({   // ← 加这几行
    value: t.name,
    label: t.name,
  }))}
/>
              </div>
            </div>

            {/* 文件列表 */}
            <div className="up-file-list">
              <AnimatePresence>
                {files.length === 0 && (
                  <motion.div
                    className="up-empty-hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <span>从左侧拖入图片</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
  {files.map((entry, i) => (
    <FileCard
      key={entry.id}
      entry={entry}
      onRemove={removeFile}
    />
  ))}
</AnimatePresence>
            </div>

            {/* 上传按钮 */}
            <AnimatePresence>
              {pendingCount > 0 && !uploading && (
                <motion.button
                  className="up-submit"
                  onClick={handleUpload}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring.soft}
                  data-cursor="hover"
                >
                  <span>上传 {pendingCount} 张影像</span>
                  <span className="up-submit-arrow">→</span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

/* ─── CSS ─── */
const uploadCSS = `
.up-root {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--ink-1);
  font-family: var(--font-sans);
  padding: 40px;
}

.up-layout {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 36px;
  align-items: start;
}

/* ── drop zone ── */
.up-dz {
  background: var(--bg-elevated);
  border: 1.5px dashed var(--line-2);
  border-radius: var(--radius-lg);
  padding: 56px 40px;
  text-align: center;
  position: relative;
  overflow: hidden;
  transition: border-color var(--dur-normal) var(--ease-out),
              background var(--dur-normal) var(--ease-out);
}
.up-dz.active {
  border-color: var(--gold);
  background: rgba(200, 169, 110, 0.04);
}

.up-funnel {
  position: relative;
  width: 72px;
  height: 72px;
  margin: 0 auto 24px;
  color: var(--gold);
}
.up-funnel-svg {
  width: 100%;
  height: 100%;
}
.up-particle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: var(--gold);
  border-radius: 50%;
}

.up-dz-kana {
  font-family: var(--font-mincho);
  font-size: 10px;
  letter-spacing: 0.32em;
  color: var(--gold);
  margin-bottom: 12px;
}
.up-dz-title {
  font-family: var(--font-mincho);
  font-size: 28px;
  font-weight: 500;
  line-height: 1.25;
  margin-bottom: 12px;
  color: var(--ink-1);
}
.up-dz-title em {
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--gold);
}
.up-dz-sub {
  font-size: 12px;
  color: var(--ink-4);
  line-height: 2;
}
.up-dz-dots {
  color: var(--ink-5);
  font-family: var(--font-garamond);
  font-style: italic;
  margin: 8px 0 16px;
  letter-spacing: 0.2em;
}
.up-dz-btn {
  display: inline-block;
  background: var(--ink-1);
  color: var(--bg-primary);
  padding: 9px 24px;
  font-size: 12px;
  letter-spacing: 0.08em;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-sans);
  transition: background var(--dur-fast) var(--ease-out);
  margin-bottom: 20px;
}
.up-dz-btn:hover { background: var(--gold); }

.up-dz-formats {
  display: flex;
  gap: 8px;
  justify-content: center;
  font-size: 10px;
  color: var(--ink-5);
  letter-spacing: 0.08em;
  font-family: var(--font-garamond);
  font-style: italic;
}

.up-dz-pulse {
  position: absolute;
  inset: 4px;
  border: 2px solid var(--gold);
  border-radius: var(--radius-lg);
  pointer-events: none;
  box-shadow: 0 0 20px rgba(200, 169, 110, 0.3);
}

/* ── queue ── */
.up-queue {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.up-q-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line-3);
}
.up-q-title {
  font-family: var(--font-mincho);
  font-size: 16px;
  letter-spacing: 0.04em;
}
.up-q-sub {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 13px;
  color: var(--ink-4);
}
.up-q-clear {
  font-size: 11px;
  color: var(--ink-4);
  background: none;
  border: 1px solid var(--line-2);
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  transition: all var(--dur-fast) var(--ease-out);
}
.up-q-clear:hover {
  background: var(--ink-1);
  color: var(--bg-primary);
  border-color: var(--ink-1);
}

/* 总进度卡片 */
.up-total-card {
  background: var(--ink-1);
  color: var(--bg-primary);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  display: flex;
  gap: 20px;
  align-items: center;
}
.up-circle-wrap {
  position: relative;
  flex-shrink: 0;
}
.up-circle-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
}
.up-circle-val {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 24px;
  line-height: 1;
}
.up-circle-total {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 13px;
  color: rgba(248,245,240,0.5);
  margin-top: 6px;
}
.up-total-info { flex: 1; }
.up-total-label {
  font-size: 9px;
  letter-spacing: 0.22em;
  color: rgba(248,245,240,0.5);
  font-family: var(--font-garamond);
  margin-bottom: 4px;
}
.up-total-detail {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 16px;
  margin-bottom: 10px;
}
.up-total-bar-bg {
  height: 4px;
  background: rgba(248,245,240,0.12);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}
.up-total-bar {
  height: 100%;
  background: #7a9b58;
  border-radius: 2px;
  position: relative;
}
.up-total-dot {
  position: absolute;
  right: -1px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  background: #7a9b58;
  border-radius: 50%;
  box-shadow: 0 0 8px #7a9b58;
}

/* 标签预设 */
.up-preset {
  padding: 14px;
  background: var(--line-4);
  border-radius: var(--radius-sm);
}
.up-preset-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--ink-4);
  margin-bottom: 10px;
  font-family: var(--font-garamond);
  text-transform: uppercase;
}
.up-preset-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.up-preset-tag {
  font-size: 11px;
  padding: 4px 12px;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  color: var(--ink-3);
  font-family: var(--font-sans);
  transition: all var(--dur-fast) var(--ease-out);
}
.up-preset-tag.on {
  background: var(--ink-1);
  color: var(--bg-primary);
  border-color: var(--ink-1);
}
.up-tag-select {
  min-width: 80px;
  font-size: 11px;
}
.up-tag-select .ant-select-selector {
  border-radius: var(--radius-full) !important;
  border-color: var(--line-2) !important;
  background: var(--bg-elevated) !important;
  font-size: 11px !important;
  min-height: 28px !important;
  padding: 0 10px !important;
}

/* 文件列表 */
.up-file-list {
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.up-empty-hint {
  padding: 40px;
  text-align: center;
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 13px;
  color: var(--ink-5);
  border: 1px dashed var(--line-3);
  border-radius: var(--radius-sm);
}

/* 文件卡片 */
.up-file-card {
  display: flex;
  gap: 12px;
  padding: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--line-3);
  border-radius: var(--radius-sm);
  align-items: center;
  position: relative;
  transition: border-color var(--dur-fast) var(--ease-out);
}
.up-file-card.done { border-color: rgba(122, 155, 88, 0.3); }
.up-file-card.error { border-color: rgba(168, 58, 48, 0.4); background: rgba(168, 58, 48, 0.03); }

.up-thumb {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-secondary);
  flex-shrink: 0;
}
.up-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.up-file-info { flex: 1; min-width: 0; }
.up-file-name {
  font-size: 12px;
  color: var(--ink-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 3px;
}
.up-file-size {
  font-size: 10px;
  color: var(--ink-4);
  font-family: var(--font-garamond);
  font-style: italic;
  margin-bottom: 5px;
}
.up-prog-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.up-prog-bg {
  flex: 1;
  height: 3px;
  background: var(--line-3);
  border-radius: 2px;
  overflow: hidden;
}
.up-prog-bar {
  height: 100%;
  background: #7a9b58;
  border-radius: 2px;
  position: relative;
  min-width: 3px;
}
.up-prog-dot {
  position: absolute;
  right: -1px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  background: #7a9b58;
  border-radius: 50%;
  box-shadow: 0 0 6px #7a9b58;
}
.up-prog-pct {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: var(--ink-4);
  flex-shrink: 0;
}
.up-status-done {
  display: flex;
  gap: 5px;
  align-items: center;
  font-size: 11px;
  color: #7a9b58;
  font-family: var(--font-garamond);
  font-style: italic;
}
.up-status-err {
  font-size: 11px;
  color: #a83a30;
  font-family: var(--font-garamond);
  font-style: italic;
}
.up-remove-btn {
  background: none;
  border: none;
  color: var(--ink-4);
  font-size: 13px;
  padding: 4px;
  flex-shrink: 0;
  transition: color var(--dur-fast) var(--ease-out);
}
.up-remove-btn:hover { color: #a83a30; }

/* 上传按钮 */
.up-submit {
  width: 100%;
  background: var(--ink-1);
  color: var(--bg-primary);
  border: none;
  padding: 14px;
  font-size: 13px;
  letter-spacing: 0.1em;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background var(--dur-fast) var(--ease-out);
}
.up-submit:hover { background: var(--gold); }
.up-submit-arrow {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 18px;
}

/* responsive */
@media (max-width: 800px) {
  .up-root { padding: 20px; }
  .up-layout { grid-template-columns: 1fr; }
}
`;
