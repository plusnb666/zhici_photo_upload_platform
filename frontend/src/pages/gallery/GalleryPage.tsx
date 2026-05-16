/**
 * 赤子の相册 · Gallery Page
 * 风格：Japandi 暖米白 + 远山青 accent
 *
 * 核心交互：
 *   - 侧边栏：合集（全部/我的/收藏）+ 标签快捷过滤，激活金色短指示器
 *   - 顶部工具栏：视图切换（grid / masonry / list）滑动药丸 + 排序 + 上传按钮
 *   - 批量选择：点击卡片左上角圆点进入选择模式，顶部出现批量操作栏
 *   - 拖拽重排：长按卡片可拖动，目标位置出现金色虚线 drop zone（dnd-kit）
 *   - 三种视图无缝 morphing（AnimatePresence layout）
 *   - 卡片悬浮：浮起 + 露出心形快捷收藏 + 显示上传者
 *   - 共享 layoutId：点击卡片 → ImageDetail 的图片飞入过渡
 *
 * 依赖：framer-motion @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
 */

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Popconfirm } from 'antd';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { imagesAPI } from '../../api/images';
import { tagsAPI } from '../../api/tags';
import { useAuthStore } from '../../store/authStore';
import { formatFileSize, formatDate } from '../../utils/format';
import { spring, ease, fadeUp, staggerContainer, staggerItem } from '../../utils/motion';

/* ─── 类型 ─── */
type ViewMode = 'grid' | 'masonry' | 'list';
type SortMode = 'newest' | 'oldest' | 'name';

/* ─────────────────────────────────────────
 *  单张图片卡片（可排序）
 * ───────────────────────────────────────── */
interface ImageCardProps {
  img: any;
  selected: boolean;
  selectionMode: boolean;
  view: ViewMode;
  showUploader: boolean;
  onToggleSelect: (id: number) => void;
  onOpen: (id: number) => void;
  onCopy: (url: string) => void;
  onDelete: (id: number) => void;
}

function ImageCard({
  img,
  selected,
  selectionMode,
  view,
  showUploader,
  onToggleSelect,
  onOpen,
  onCopy,
  onDelete,
}: ImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: img.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  if (view === 'list') {
    return (
      <motion.div
        ref={setNodeRef}
        style={style}
        className={`gp-list-row ${selected ? 'sel' : ''} ${isDragging ? 'dragging' : ''}`}
        variants={staggerItem}
        layoutId={`image-${img.id}`}
        onClick={() => !selectionMode && onOpen(img.id)}
        data-cursor="hover"
        {...attributes}
      >
        <span
          className="gp-list-check"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(img.id); }}
        />
        <div className="gp-list-thumb" {...listeners}>
          <motion.img
            src={img.thumbnail_url || img.url}
            alt={img.alt_text || img.filename}
            layoutId={`image-img-${img.id}`}
          />
        </div>
        <div className="gp-list-info">
          <div className="gp-list-name">{img.filename}</div>
          <div className="gp-list-meta">
            <span>{formatFileSize(img.file_size)}</span>
            <span>·</span>
            <span>{formatDate(img.created_at)}</span>
            {showUploader && img.username && (
              <>
                <span>·</span>
                <span className="gp-list-uploader">{img.username}</span>
              </>
            )}
          </div>
        </div>
        <div className="gp-list-tags">
          {img.tags?.slice(0, 3).map((t: any) => (
            <span key={t.id} className="gp-tag-mini">{t.name}</span>
          ))}
        </div>
        <div className="gp-list-actions">
          <button
            className="gp-icon-btn"
            onClick={(e) => { e.stopPropagation(); onCopy(img.url); }}
            data-cursor="hover"
            title="复制链接"
          >⎘</button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => onDelete(img.id)}
            onCancel={(e) => e?.stopPropagation()}
          >
            <button
              className="gp-icon-btn gp-icon-danger"
              onClick={(e) => e.stopPropagation()}
              data-cursor="hover"
              title="删除"
            >✕</button>
          </Popconfirm>
        </div>
      </motion.div>
    );
  }

  /* grid / masonry 卡片 */
  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={`gp-card ${selected ? 'sel' : ''} ${isDragging ? 'dragging' : ''} ${view === 'masonry' ? 'masonry' : ''}`}
      variants={staggerItem}
      layoutId={`image-${img.id}`}
      whileHover={!isDragging ? { y: -4, transition: spring.soft } : {}}
      onClick={() => !selectionMode && onOpen(img.id)}
      data-cursor="hover"
      {...attributes}
    >
      <div className="gp-card-img-wrap" {...listeners}>
        <motion.img
          className="gp-card-img"
          src={img.thumbnail_url || img.url}
          alt={img.alt_text || img.filename}
          loading="lazy"
          layoutId={`image-img-${img.id}`}
        />

        {/* 选择圆点 */}
        <motion.span
          className="gp-card-check"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(img.id); }}
          whileHover={{ scale: 1.15 }}
          transition={spring.soft}
        />

        {/* hover overlay */}
        <div className="gp-card-overlay">
          {showUploader && img.username && (
            <span className="gp-card-uploader">{img.username}</span>
          )}
          <span className="gp-card-date">{formatDate(img.created_at)}</span>
        </div>

        {/* quick actions */}
        <div className="gp-card-actions">
          <button
            className="gp-mini-btn"
            onClick={(e) => { e.stopPropagation(); onCopy(img.url); }}
            data-cursor="hover"
          >⎘</button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => onDelete(img.id)}
          >
            <button
              className="gp-mini-btn"
              onClick={(e) => e.stopPropagation()}
              data-cursor="hover"
            >✕</button>
          </Popconfirm>
        </div>
      </div>

      <div className="gp-card-meta">
        <span className="gp-card-name" title={img.filename}>
          {img.filename.replace(/\.[^.]+$/, '')}
        </span>
        <span className="gp-card-size">{formatFileSize(img.file_size)}</span>
      </div>
      {img.tags?.length > 0 && (
        <div className="gp-card-tags">
          {img.tags.slice(0, 3).map((t: any) => (
            <span key={t.id} className="gp-tag-mini">{t.name}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────
 *  主组件
 * ───────────────────────────────────────── */
export function GalleryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mine = searchParams.get('mine') === '1';
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | undefined>();
  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortMode>('newest');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [orderOverride, setOrderOverride] = useState<number[] | null>(null);

  /* 数据 */
  const { data: imageData, isLoading } = useQuery({
    queryKey: [mine ? 'images' : 'public-images', page, search, tagFilter, sort],
    queryFn: () => mine
      ? imagesAPI.list({ page, limit: 24, search, tag: tagFilter, sort })
      : imagesAPI.listPublic({ page, limit: 24, search, tag: tagFilter, sort }),
  });

  const { data: tagData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => imagesAPI.delete(id),
    onSuccess: () => {
      message.success('已删除');
      queryClient.invalidateQueries({ queryKey: [mine ? 'images' : 'public-images'] });
    },
  });

  const rawImages = imageData?.data?.data?.items ?? [];
  const total = imageData?.data?.data?.total ?? 0;
  const tags = tagData?.data?.data?.items ?? [];

  /* 应用拖拽后的本地顺序 */
  const images = useMemo(() => {
    if (!orderOverride) return rawImages;
    const map = new Map(rawImages.map((i: any) => [i.id, i]));
    return orderOverride.map(id => map.get(id)).filter(Boolean);
  }, [rawImages, orderOverride]);

  /* 拖拽传感器 */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const ids = images.map((i: any) => i.id);
      const oldIdx = ids.indexOf(active.id as number);
      const newIdx = ids.indexOf(over.id as number);
      setOrderOverride(arrayMove(ids, oldIdx, newIdx));
    }
  };

  /* 选择操作 */
  const toggleSelect = (id: number) => {
    setSelectionMode(true);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };
  const clearSelection = () => { setSelected(new Set()); setSelectionMode(false); };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    try {
      await imagesAPI.batchDelete(Array.from(selected));
      message.success(`已删除 ${selected.size} 张`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: [mine ? 'images' : 'public-images'] });
    } catch {
      message.error('删除失败');
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    message.success('链接已复制');
  };

  const handleOpen = (id: number) => navigate(`/gallery/${id}`);

  /* 视图药丸位置 */
  const viewIndex = { grid: 0, masonry: 1, list: 2 }[view];

  return (
    <>
      <style>{galleryCSS}</style>

      <motion.div
        className="gp-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: ease.out as any }}
      >
        {/* ── 侧边栏 ── */}
        <motion.aside
          className="gp-sb"
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: ease.out as any }}
        >
          <div className="gp-sb-logo">
            赤子の相册
            <span className="gp-sb-sub">chizi · gallery</span>
          </div>

          <div className="gp-sb-section">COLLECTIONS</div>
          <button
            className={`gp-sb-item ${!mine ? 'on' : ''}`}
            onClick={() => navigate('/gallery')}
            data-cursor="hover"
          >
            全部影像
            <span className="gp-sb-count">{!mine ? total : '—'}</span>
          </button>
          <button
            className={`gp-sb-item ${mine ? 'on' : ''}`}
            onClick={() => navigate('/gallery?mine=1')}
            data-cursor="hover"
          >
            我的上传
            <span className="gp-sb-count">{mine ? total : '—'}</span>
          </button>

          <div className="gp-sb-section">TAGS</div>
          {tags.slice(0, 8).map((t: any) => (
            <button
              key={t.id}
              className={`gp-sb-item ${tagFilter === t.name ? 'on' : ''}`}
              onClick={() => setTagFilter(prev => prev === t.name ? undefined : t.name)}
              data-cursor="hover"
            >
              · {t.name}
              <span className="gp-sb-count">{t.count ?? 0}</span> 
            </button>
          ))}

          {user && (
  <div
    className="gp-sb-user"
    onClick={() => navigate('/profile')}
    data-cursor="hover"
    style={{ cursor: 'pointer' }}
  >
    <div className="gp-sb-avatar">{user.username[0]}</div>
    <div>
      <div className="gp-sb-name">{user.username}</div>
      <div className="gp-sb-role">{user.role}</div>
    </div>
  </div>
)}
        </motion.aside>

        {/* ── 主区 ── */}
        <main className="gp-main">
          {/* 顶部 bar */}
          <motion.div
            className="gp-top"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <div className="gp-top-l">
              <div className="gp-bc">
                <em>{mine ? 'my uploads' : 'full archive'}</em>
              </div>
              <h1 className="gp-title">
                {mine ? '我的上传' : '全部影像'}
                {tagFilter && <span className="gp-title-filter">· #{tagFilter}</span>}
              </h1>
            </div>

            <div className="gp-top-r">
              {/* 搜索 */}
              <input
                className="gp-search"
                placeholder="搜索..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />

              {/* 视图切换 */}
              <div className="gp-view">
                <motion.div
                  className="gp-view-pill"
                  animate={{ x: viewIndex * 56 }}
                  transition={spring.default}
                />
                <button
                  className={`gp-view-btn ${view === 'grid' ? 'on' : ''}`}
                  onClick={() => setView('grid')}
                  data-cursor="hover"
                >◫ grid</button>
                <button
                  className={`gp-view-btn ${view === 'masonry' ? 'on' : ''}`}
                  onClick={() => setView('masonry')}
                  data-cursor="hover"
                >⊞ wall</button>
                <button
                  className={`gp-view-btn ${view === 'list' ? 'on' : ''}`}
                  onClick={() => setView('list')}
                  data-cursor="hover"
                >≡ list</button>
              </div>

              {/* 排序 */}
              <select
                className="gp-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                data-cursor="hover"
              >
                <option value="newest">newest ↓</option>
                <option value="oldest">oldest ↑</option>
                <option value="name">name a-z</option>
              </select>

              <motion.button
                className="gp-upload-btn"
                onClick={() => navigate('/upload')}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={spring.soft}
                data-cursor="hover"
              >
                + 上传
              </motion.button>
            </div>
          </motion.div>

          {/* 批量操作工具栏 */}
          <AnimatePresence>
            {selectionMode && (
              <motion.div
                className="gp-sel-bar"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: ease.out as any }}
              >
                <span className="gp-sel-count">{selected.size} selected</span>
                <span className="gp-sel-sep">·</span>
                <span className="gp-sel-hint">drag to reorder, or:</span>
                <div className="gp-sel-actions">
                  <Popconfirm title={`删除选中的 ${selected.size} 张？`} onConfirm={handleBatchDelete}>
                    <button data-cursor="hover">删除</button>
                  </Popconfirm>
                  <button onClick={clearSelection} className="gp-sel-close" data-cursor="hover">✕</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 内容区 */}
          {isLoading ? (
            <SkeletonGrid view={view} />
          ) : images.length === 0 ? (
            <motion.div
              className="gp-empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="gp-empty-mark">空</div>
              <p>暂无影像</p>
              <button className="gp-empty-btn" onClick={() => navigate('/upload')} data-cursor="hover">
                + 上传第一张
              </button>
            </motion.div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <LayoutGroup>
                <AnimatePresence mode="popLayout">
                  <SortableContext items={images.map((i: any) => i.id)} strategy={rectSortingStrategy}>
                    <motion.div
                      key={view}
                      className={`gp-${view}`}
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0 }}
                    >
                      {images.map((img: any) => (
                        <ImageCard
                          key={img.id}
                          img={img}
                          selected={selected.has(img.id)}
                          selectionMode={selectionMode}
                          view={view}
                          showUploader={!mine}
                          onToggleSelect={toggleSelect}
                          onOpen={handleOpen}
                          onCopy={handleCopyUrl}
                          onDelete={(id) => deleteMutation.mutate(id)}
                        />
                      ))}
                    </motion.div>
                  </SortableContext>
                </AnimatePresence>
              </LayoutGroup>
            </DndContext>
          )}

          {/* 分页 */}
          {total > 24 && (
            <motion.div
              className="gp-pager"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <button
                className="gp-page-btn"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                data-cursor="hover"
              >‹</button>
              <span className="gp-page-info">
                <em>{page}</em> / {Math.ceil(total / 24)}
              </span>
              <button
                className="gp-page-btn"
                disabled={page >= Math.ceil(total / 24)}
                onClick={() => setPage(p => p + 1)}
                data-cursor="hover"
              >›</button>
              <span className="gp-page-total">共 {total} 张</span>
            </motion.div>
          )}
        </main>
      </motion.div>
    </>
  );
}

/* ─── 骨架屏 ─── */
function SkeletonGrid({ view }: { view: ViewMode }) {
  const count = view === 'list' ? 6 : 12;
  return (
    <div className={`gp-${view}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={view === 'list' ? 'gp-list-skel' : 'gp-card-skel'}
          style={{
            height: view === 'masonry' ? 180 + Math.random() * 160 : undefined,
            animationDelay: `${i * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── CSS ─── */
const galleryCSS = `
.gp-root {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--ink-1);
  font-family: var(--font-sans);
  display: grid;
  grid-template-columns: 220px 1fr;
}

/* ── sidebar ── */
.gp-sb {
  padding: 24px 16px;
  border-right: 1px solid var(--line-3);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 0;
  height: 100vh;
}
.gp-sb-logo {
  font-family: var(--font-mincho);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.06em;
  margin-bottom: 18px;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.gp-sb-sub {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 10px;
  color: var(--ink-4);
  letter-spacing: 0.12em;
}
.gp-sb-section {
  font-family: var(--font-garamond);
  font-size: 9px;
  letter-spacing: 0.22em;
  color: var(--ink-5);
  margin: 14px 8px 4px;
  text-transform: uppercase;
}
.gp-sb-item {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--ink-3);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  font-family: var(--font-sans);
  text-align: left;
  transition: background-color var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out);
}
.gp-sb-item:hover {
  background: var(--line-4);
}
.gp-sb-item.on {
  background: var(--ink-1);
  color: var(--bg-primary);
}
.gp-sb-item.on::before {
  content: '';
  position: absolute;
  left: -16px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 14px;
  background: var(--accent-gallery);
}
.gp-sb-count {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 10px;
  opacity: 0.7;
}

.gp-sb-user {
  margin-top: auto;
  padding: 12px;
  background: var(--line-4);
  border-radius: var(--radius-sm);
  display: flex;
  gap: 10px;
  align-items: center;
}
.gp-sb-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-gallery);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mincho);
  font-size: 14px;
  text-transform: uppercase;
}
.gp-sb-name {
  font-size: 12px;
}
.gp-sb-role {
  font-size: 10px;
  color: var(--ink-4);
  font-family: var(--font-garamond);
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── main ── */
.gp-main {
  padding: 24px 32px;
  overflow: hidden;
}
.gp-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line-3);
  margin-bottom: 18px;
  gap: 16px;
  flex-wrap: wrap;
}
.gp-bc em {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: var(--ink-4);
  letter-spacing: 0.06em;
}
.gp-title {
  font-family: var(--font-mincho);
  font-size: 26px;
  letter-spacing: 0.02em;
  margin-top: 4px;
}
.gp-title-filter {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 16px;
  color: var(--accent-gallery);
  margin-left: 10px;
}

.gp-top-r {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.gp-search {
  background: none;
  border: none;
  border-bottom: 1px solid var(--line-2);
  padding: 6px 0;
  font-size: 12px;
  color: var(--ink-1);
  width: 160px;
  outline: none;
  font-family: var(--font-sans);
  transition: border-color var(--dur-fast) var(--ease-out);
}
.gp-search:focus { border-color: var(--accent-gallery); }
.gp-search::placeholder { color: var(--ink-5); }

.gp-view {
  position: relative;
  display: flex;
  background: var(--line-4);
  border-radius: var(--radius-sm);
  padding: 3px;
}
.gp-view-pill {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 52px;
  height: calc(100% - 6px);
  background: var(--ink-1);
  border-radius: var(--radius-sm);
  z-index: 0;
}
.gp-view-btn {
  position: relative;
  z-index: 1;
  width: 56px;
  padding: 5px 0;
  font-family: var(--font-garamond);
  font-size: 11px;
  font-style: italic;
  background: none;
  border: none;
  color: var(--ink-3);
  transition: color var(--dur-fast) var(--ease-out);
}
.gp-view-btn.on { color: var(--bg-primary); }

.gp-sort {
  background: none;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: var(--ink-3);
  outline: none;
}

.gp-upload-btn {
  background: var(--ink-1);
  color: var(--bg-primary);
  border: none;
  padding: 7px 16px;
  font-size: 12px;
  letter-spacing: 0.06em;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
}

/* ── 批量操作栏 ── */
.gp-sel-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 16px;
  background: var(--ink-1);
  color: var(--bg-primary);
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
  font-size: 11px;
  letter-spacing: 0.04em;
}
.gp-sel-count {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 14px;
}
.gp-sel-sep { opacity: 0.4; }
.gp-sel-hint { opacity: 0.6; }
.gp-sel-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.gp-sel-actions button {
  background: rgba(248,245,240,0.1);
  border: none;
  color: var(--bg-primary);
  padding: 5px 12px;
  font-size: 11px;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  transition: background var(--dur-fast) var(--ease-out);
}
.gp-sel-actions button:hover {
  background: rgba(248,245,240,0.2);
}
.gp-sel-close { background: transparent !important; }

/* ── GRID 视图 ── */
.gp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

/* ── MASONRY 视图 ── */
.gp-masonry {
  columns: 4 200px;
  column-gap: 14px;
}
.gp-masonry .gp-card { break-inside: avoid; margin-bottom: 14px; display: block; }

/* ── 卡片 ── */
.gp-card {
  cursor: pointer;
  position: relative;
}
.gp-card.dragging {
  opacity: 0.5;
}
.gp-card-img-wrap {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  aspect-ratio: 1;
}
.gp-card.masonry .gp-card-img-wrap {
  aspect-ratio: auto;
}
.gp-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform var(--dur-slow) var(--ease-out),
              filter var(--dur-normal) var(--ease-out);
}
.gp-card.masonry .gp-card-img {
  height: auto;
}
.gp-card:hover .gp-card-img {
  transform: scale(1.04);
  filter: brightness(0.96);
}

.gp-card.sel .gp-card-img-wrap {
  outline: 2px solid var(--accent-gallery);
  outline-offset: -2px;
}
.gp-card.sel .gp-card-check {
  background: var(--accent-gallery);
  border-color: var(--accent-gallery);
}
.gp-card.sel .gp-card-check::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 4px;
  height: 9px;
  border: solid #fff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}

.gp-card-check {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 18px;
  height: 18px;
  border: 1.5px solid rgba(248,245,240,0.7);
  border-radius: 50%;
  background: rgba(44,42,39,0.3);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 2;
  transition: background var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out);
}

.gp-card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(44,42,39,0.6) 0%, transparent 50%);
  opacity: 0;
  transition: opacity var(--dur-normal) var(--ease-out);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 12px;
  pointer-events: none;
  border-radius: var(--radius-sm);
}
.gp-card:hover .gp-card-overlay { opacity: 1; }
.gp-card-uploader {
  color: rgba(248,245,240,0.9);
  font-size: 11px;
  letter-spacing: 0.04em;
}
.gp-card-date {
  color: rgba(248,245,240,0.7);
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
}

.gp-card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--dur-normal) var(--ease-out);
  z-index: 2;
}
.gp-card:hover .gp-card-actions { opacity: 1; }
.gp-mini-btn {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: rgba(44,42,39,0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: #fff;
  border: none;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--dur-fast) var(--ease-out);
}
.gp-mini-btn:hover { background: rgba(44,42,39,0.75); }

.gp-card-meta {
  padding: 8px 2px 4px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 11px;
}
.gp-card-name {
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.gp-card-size {
  color: var(--ink-5);
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 10px;
  flex-shrink: 0;
}
.gp-card-tags {
  display: flex;
  gap: 4px;
  margin-top: 2px;
  flex-wrap: wrap;
}
.gp-tag-mini {
  font-size: 10px;
  padding: 1px 7px;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  color: var(--ink-4);
}

/* ── LIST 视图 ── */
.gp-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-top: 1px solid var(--line-3);
}
.gp-list-row {
  display: grid;
  grid-template-columns: 24px 60px 1fr auto auto;
  gap: 14px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-3);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out);
  position: relative;
}
.gp-list-row:hover { background: var(--line-4); }
.gp-list-row.sel { background: rgba(154,171,160,0.08); }
.gp-list-row.sel::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--accent-gallery);
}
.gp-list-check {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--line-1);
  border-radius: 50%;
  position: relative;
  transition: background var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out);
}
.gp-list-row.sel .gp-list-check {
  background: var(--accent-gallery);
  border-color: var(--accent-gallery);
}
.gp-list-row.sel .gp-list-check::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 0px;
  width: 4px;
  height: 9px;
  border: solid #fff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}
.gp-list-thumb {
  width: 60px;
  height: 60px;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
}
.gp-list-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.gp-list-name {
  font-size: 13px;
  color: var(--ink-1);
  margin-bottom: 3px;
}
.gp-list-meta {
  font-size: 11px;
  color: var(--ink-4);
  display: flex;
  gap: 6px;
  font-family: var(--font-garamond);
  font-style: italic;
}
.gp-list-uploader { color: var(--accent-gallery); }
.gp-list-tags { display: flex; gap: 4px; }
.gp-list-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out);
}
.gp-list-row:hover .gp-list-actions { opacity: 1; }
.gp-icon-btn {
  width: 26px;
  height: 26px;
  background: none;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  color: var(--ink-3);
  font-size: 11px;
  transition: all var(--dur-fast) var(--ease-out);
}
.gp-icon-btn:hover {
  background: var(--ink-1);
  color: var(--bg-primary);
  border-color: var(--ink-1);
}
.gp-icon-danger:hover {
  background: #a83a30;
  border-color: #a83a30;
}

/* ── 空状态 ── */
.gp-empty {
  padding: 100px 0;
  text-align: center;
  color: var(--ink-4);
}
.gp-empty-mark {
  font-family: var(--font-mincho);
  font-size: 56px;
  color: var(--line-2);
  margin-bottom: 12px;
}
.gp-empty p {
  font-family: var(--font-mincho);
  font-size: 14px;
  letter-spacing: 0.1em;
  margin-bottom: 20px;
}
.gp-empty-btn {
  background: var(--ink-1);
  color: var(--bg-primary);
  border: none;
  padding: 9px 24px;
  font-size: 12px;
  letter-spacing: 0.08em;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
}

/* ── 骨架屏 ── */
.gp-card-skel, .gp-list-skel {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--line-4) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: gp-shimmer 1.6s infinite;
  border-radius: var(--radius-sm);
}
.gp-card-skel { aspect-ratio: 1; }
.gp-list-skel { height: 80px; margin-bottom: 1px; }
@keyframes gp-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── 分页 ── */
.gp-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 0 20px;
}
.gp-page-btn {
  width: 32px;
  height: 32px;
  background: none;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  font-family: var(--font-garamond);
  font-size: 14px;
  color: var(--ink-3);
  transition: all var(--dur-fast) var(--ease-out);
}
.gp-page-btn:hover:not(:disabled) {
  background: var(--ink-1);
  color: var(--bg-primary);
  border-color: var(--ink-1);
}
.gp-page-btn:disabled { opacity: 0.3; }
.gp-page-info {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 13px;
  color: var(--ink-3);
  padding: 0 8px;
}
.gp-page-info em {
  font-style: normal;
  font-size: 16px;
  color: var(--ink-1);
}
.gp-page-total {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: var(--ink-4);
  margin-left: 12px;
}

/* ── 响应式 ── */
@media (max-width: 900px) {
  .gp-root { grid-template-columns: 1fr; }
  .gp-sb { display: none; }
  .gp-main { padding: 20px; }
}
`;
