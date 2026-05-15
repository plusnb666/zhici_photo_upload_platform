/**
 * 赤子の相册 · 标签管理页
 * 仅管理员可访问（AdminRoute 已保护）
 * 
 * 功能：
 *   - 查看所有标签（含使用计数）
 *   - 创建新标签（名称 + 颜色）
 *   - 删除标签（二次确认）
 *   - 颜色选择：预设 8 色 + 自定义
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message, Popconfirm } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { tagsAPI } from '../../api/tags';
import { spring, ease, staggerContainer, staggerItem } from '../../utils/motion';

const PRESET_COLORS = [
  '#c8a96e', // 枯叶金
  '#9aaba0', // 远山青
  '#b8b0c0', // 灰紫
  '#7a9b58', // 苔绿
  '#4a5b75', // 深蓝
  '#a83a30', // 朱红
  '#c9b8a8', // 暖棕
  '#2c2a27', // 深墨
];

export function TagManagePage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [customColor, setCustomColor] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tags-manage'],
    queryFn: () => tagsAPI.list(),
  });

  const tags = data?.data?.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () => tagsAPI.create({ name: newName.trim(), color: customColor || newColor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags-manage'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      message.success('标签已创建');
      setNewName('');
      setCustomColor('');
    },
    onError: (err: any) => message.error(err.response?.data?.message || '创建失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tagsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags-manage'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      message.success('已删除');
    },
    onError: (err: any) => message.error(err.response?.data?.message || '删除失败'),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) { message.warning('请输入标签名称'); return; }
    createMutation.mutate();
  };

  const activeColor = customColor || newColor;

  return (
    <>
      <style>{tagManageCSS}</style>
      <motion.div className="tm-root" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: ease.out as any }}>

        {/* 顶部 */}
        <div className="tm-top">
          <div>
            <p className="tm-kana">T A G S · M A N A G E</p>
            <h1 className="tm-title">标签管理 <em>· admin only</em></h1>
          </div>
          <div className="tm-meta">
            <span className="tm-total">{tags.length}</span>
            <span className="tm-total-lbl">个标签</span>
          </div>
        </div>

        <div className="tm-layout">
          {/* 左：创建表单 */}
          <motion.div className="tm-create" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: ease.out as any }}>
            <h2 className="tm-create-title">创建新标签</h2>

            <form onSubmit={handleCreate} className="tm-form">
              <div className="tm-field">
                <label className="tm-label">标签名称</label>
                <input
                  className="tm-input"
                  placeholder="例：优秀、打印、收藏…"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  maxLength={32}
                />
              </div>

              <div className="tm-field">
                <label className="tm-label">标签颜色</label>
                <div className="tm-colors">
                  {PRESET_COLORS.map(c => (
                    <motion.button
                      key={c}
                      type="button"
                      className={`tm-color-dot ${newColor === c && !customColor ? 'on' : ''}`}
                      style={{ background: c }}
                      onClick={() => { setNewColor(c); setCustomColor(''); }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      transition={spring.soft}
                      data-cursor="hover"
                    />
                  ))}
                  <div className="tm-color-custom-wrap" title="自定义颜色">
                    <input
                      type="color"
                      className="tm-color-picker"
                      value={customColor || newColor}
                      onChange={e => setCustomColor(e.target.value)}
                    />
                    <span className="tm-color-picker-label">+</span>
                  </div>
                </div>

                {/* 预览 */}
                <div className="tm-preview">
                  <span className="tm-preview-chip" style={{ borderColor: activeColor, color: activeColor }}>
                    {newName || '预览标签'}
                  </span>
                  <span className="tm-preview-color">{activeColor}</span>
                </div>
              </div>

              <motion.button
                type="submit"
                className="tm-submit"
                disabled={createMutation.isPending || !newName.trim()}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.soft}
                data-cursor="hover"
              >
                {createMutation.isPending ? '创建中…' : '+ 创建标签'}
              </motion.button>
            </form>
          </motion.div>

          {/* 右：标签列表 */}
          <div className="tm-list-panel">
            <div className="tm-list-head">
              <h2 className="tm-create-title">所有标签</h2>
              <span className="tm-list-hint">使用次数从高到低排列</span>
            </div>

            {isLoading ? (
              <div className="tm-loading">加载中…</div>
            ) : (
              <motion.div className="tm-list" variants={staggerContainer} initial="hidden" animate="visible">
                <AnimatePresence>
                  {tags.map((tag: any) => (
                    <motion.div
                      key={tag.id}
                      className="tm-row"
                      variants={staggerItem}
                      layout
                      exit={{ opacity: 0, x: -20 }}
                    >
                      {/* 色块 */}
                      <div className="tm-row-color" style={{ background: tag.color || '#c8a96e' }} />

                      {/* 名称 */}
                      <div className="tm-row-info">
                        <span className="tm-row-name"
                          style={{ borderBottomColor: tag.color || 'var(--gold)' }}>
                          {tag.name}
                        </span>
                        <span className="tm-row-color-val">{tag.color}</span>
                      </div>

                      {/* 使用计数 */}
                      <div className="tm-row-count">
                        <span className="tm-count-n">{tag.count ?? 0}</span>
                        <span className="tm-count-l">次使用</span>
                      </div>

                      {/* 使用量横条 */}
                      <div className="tm-row-bar-bg">
                        <motion.div
                          className="tm-row-bar"
                          style={{ background: tag.color || 'var(--gold)' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(((tag.count ?? 0) / Math.max(...tags.map((t: any) => t.count ?? 0), 1)) * 100, 100)}%` }}
                          transition={{ duration: 0.7, ease: ease.out as any }}
                        />
                      </div>

                      {/* 删除 */}
                      <Popconfirm
                        title={`确认删除「${tag.name}」？相关标记也会删除。`}
                        onConfirm={() => deleteMutation.mutate(tag.id)}
                        okText="删除"
                        cancelText="取消"
                      >
                        <motion.button
                          className="tm-delete"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          transition={spring.soft}
                          data-cursor="hover"
                        >✕</motion.button>
                      </Popconfirm>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {tags.length === 0 && (
                  <div className="tm-empty">
                    <span className="tm-empty-mark">空</span>
                    <p>暂无标签，从左侧创建第一个</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

const tagManageCSS = `
.tm-root {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--ink-1);
  font-family: var(--font-sans);
  padding: 32px 40px;
  max-width: 1100px;
  margin: 0 auto;
}

.tm-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line-3);
  margin-bottom: 28px;
}
.tm-kana {
  font-family: var(--font-mincho);
  font-size: 10px;
  letter-spacing: 0.28em;
  color: var(--gold);
  margin-bottom: 4px;
}
.tm-title {
  font-family: var(--font-mincho);
  font-size: 24px;
}
.tm-title em {
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--ink-4);
  font-size: 14px;
  margin-left: 8px;
}
.tm-meta { text-align: right; }
.tm-total {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 36px;
  color: var(--ink-1);
  line-height: 1;
}
.tm-total-lbl {
  font-size: 11px;
  color: var(--ink-4);
  margin-left: 4px;
  font-family: var(--font-garamond);
  font-style: italic;
}

.tm-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 32px;
  align-items: start;
}

/* 创建表单 */
.tm-create {
  background: var(--bg-elevated);
  border: 1px solid var(--line-3);
  border-radius: var(--radius-md);
  padding: 24px;
  position: sticky;
  top: 24px;
}
.tm-create-title {
  font-family: var(--font-mincho);
  font-size: 15px;
  letter-spacing: 0.06em;
  margin-bottom: 20px;
}
.tm-form { display: flex; flex-direction: column; gap: 18px; }
.tm-field { display: flex; flex-direction: column; gap: 8px; }
.tm-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--ink-4);
  font-family: var(--font-garamond);
  font-style: italic;
  text-transform: uppercase;
}
.tm-input {
  background: none;
  border: none;
  border-bottom: 1px solid var(--line-2);
  padding: 8px 0;
  font-size: 14px;
  color: var(--ink-1);
  font-family: var(--font-sans);
  outline: none;
  transition: border-color var(--dur-fast) var(--ease-out);
}
.tm-input:focus { border-color: var(--gold); }
.tm-input::placeholder { color: var(--ink-5); font-size: 12px; }

.tm-colors {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.tm-color-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-out);
}
.tm-color-dot.on {
  border-color: var(--ink-1);
  box-shadow: 0 0 0 2px var(--bg-elevated), 0 0 0 4px var(--ink-1);
}
.tm-color-custom-wrap {
  position: relative;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px dashed var(--line-2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
}
.tm-color-picker {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}
.tm-color-picker-label {
  font-size: 14px;
  color: var(--ink-4);
  pointer-events: none;
}

.tm-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
.tm-preview-chip {
  font-size: 12px;
  padding: 4px 12px;
  border: 1px solid;
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
}
.tm-preview-color {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: var(--ink-4);
}

.tm-submit {
  background: var(--ink-1);
  color: var(--bg-primary);
  border: none;
  padding: 11px;
  font-size: 12px;
  letter-spacing: 0.1em;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  transition: background var(--dur-fast) var(--ease-out);
  margin-top: 4px;
}
.tm-submit:hover:not(:disabled) { background: var(--gold); }
.tm-submit:disabled { opacity: 0.5; }

/* 标签列表 */
.tm-list-panel {}
.tm-list-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 14px;
}
.tm-list-hint {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: var(--ink-4);
}
.tm-list { display: flex; flex-direction: column; gap: 2px; }
.tm-row {
  display: grid;
  grid-template-columns: 10px 1fr auto 120px 32px;
  gap: 14px;
  align-items: center;
  padding: 12px 8px;
  border-bottom: 1px solid var(--line-3);
  transition: background var(--dur-fast) var(--ease-out);
}
.tm-row:hover { background: var(--line-4); }
.tm-row-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tm-row-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tm-row-name {
  font-size: 13px;
  color: var(--ink-1);
  border-bottom: 1px solid;
  display: inline-block;
  padding-bottom: 1px;
  max-width: fit-content;
}
.tm-row-color-val {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 10px;
  color: var(--ink-5);
}
.tm-row-count { text-align: right; flex-shrink: 0; }
.tm-count-n {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 20px;
  color: var(--ink-1);
  display: block;
  line-height: 1;
}
.tm-count-l {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--ink-5);
  font-family: var(--font-garamond);
}
.tm-row-bar-bg {
  height: 4px;
  background: var(--line-3);
  border-radius: 2px;
  overflow: hidden;
}
.tm-row-bar { height: 100%; border-radius: 2px; }
.tm-delete {
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  color: var(--ink-4);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--dur-fast) var(--ease-out);
  justify-self: end;
}
.tm-delete:hover { background: #a83a30; color: #fff; border-color: #a83a30; }

.tm-empty {
  padding: 60px;
  text-align: center;
  color: var(--ink-5);
}
.tm-empty-mark {
  font-family: var(--font-mincho);
  font-size: 48px;
  color: var(--line-2);
  display: block;
  margin-bottom: 12px;
}
.tm-empty p {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 13px;
}

.tm-loading {
  padding: 40px;
  text-align: center;
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--ink-4);
}

@media (max-width: 768px) {
  .tm-root { padding: 20px; }
  .tm-layout { grid-template-columns: 1fr; }
  .tm-create { position: static; }
}
`;
