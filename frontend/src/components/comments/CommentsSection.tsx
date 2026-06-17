import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { imagesAPI } from '../../api/images';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../utils/format';
import { spring, staggerItem } from '../../utils/motion';

interface Props {
  imageId: number;
  isAuthenticated: boolean;
}

export function CommentsSection({ imageId, isAuthenticated }: Props) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [text, setText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['comments', imageId],
    queryFn: () =>
      isAuthenticated
        ? imagesAPI.listComments(imageId)
        : imagesAPI.listPublicComments(imageId),
  });

  const createMutation = useMutation({
    mutationFn: (content: string) => imagesAPI.createComment(imageId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', imageId] });
      setText('');
      message.success('已评论');
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || '评论失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => imagesAPI.deleteComment(imageId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', imageId] });
      message.success('已删除');
    },
  });

  const comments: any[] = data?.data?.data ?? [];

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const charCount = [...trimmed].length;
    if (charCount > 1000) {
      message.error('最多 1000 字');
      return;
    }
    createMutation.mutate(trimmed);
  };

  return (
    <>
      <style>{commentsCSS}</style>
      <motion.div
        className="cm-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="cm-title">
          评论 <span className="cm-count">{comments.length}</span>
        </h3>

        {/* 评论列表 */}
        <div className="cm-list">
          <AnimatePresence>
            {comments.map((c: any) => (
              <motion.div
                key={c.id}
                className="cm-item"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={spring.soft}
              >
                <div className="cm-avatar">
                  {(c.username || '?')[0].toUpperCase()}
                </div>
                <div className="cm-body">
                  <div className="cm-header">
                    <span className="cm-username">{c.username}</span>
                    <span className="cm-time">{formatDateTime(c.created_at)}</span>
                  </div>
                  <div className="cm-content">{c.content}</div>
                </div>
                {(user?.id === c.user_id || user?.role === 'admin') && (
                  <button
                    className="cm-delete"
                    onClick={() => deleteMutation.mutate(c.id)}
                    title="删除"
                  >
                    ✕
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {!isLoading && comments.length === 0 && (
            <p className="cm-empty">暂无评论，来说点什么吧</p>
          )}
        </div>

        {/* 输入区 */}
        {isAuthenticated ? (
          <div className="cm-input-row">
            <div className="cm-avatar cm-avatar-me">
              {(user?.username || '?')[0].toUpperCase()}
            </div>
            <div className="cm-input-col">
              <textarea
                className="cm-textarea"
                placeholder="写下你的评论..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <span className={`cm-counter ${[...text].length > 1000 ? 'cm-counter-over' : ''}`}>
                {[...text].length}/1000
              </span>
            </div>
            <button
              className="cm-submit"
              onClick={handleSubmit}
              disabled={!text.trim() || createMutation.isPending}
            >
              发送
            </button>
          </div>
        ) : (
          <p className="cm-login-hint">
            <a href="/login">登录</a>后即可评论
          </p>
        )}
      </motion.div>
    </>
  );
}

const commentsCSS = `
.cm-root {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 24px 80px;
}
.cm-title {
  font-family: 'EB Garamond', 'Noto Serif SC', serif;
  font-size: 20px;
  font-weight: 500;
  color: #2c2a27;
  margin-bottom: 24px;
  letter-spacing: 0.02em;
}
.cm-count {
  font-size: 14px;
  color: #c8a96e;
  margin-left: 8px;
  font-family: 'Noto Sans SC', sans-serif;
}

.cm-list {
  margin-bottom: 28px;
}
.cm-empty {
  color: #aaa8a4;
  font-size: 14px;
  text-align: center;
  padding: 40px 0;
  font-family: 'Noto Sans SC', sans-serif;
}

.cm-item {
  display: flex;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid rgba(44,42,39,0.06);
  position: relative;
  align-items: flex-start;
}
.cm-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #2c2a27;
  color: #f8f5f0;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: 'Noto Sans SC', sans-serif;
  letter-spacing: 0.04em;
}
.cm-body {
  flex: 1;
  min-width: 0;
}
.cm-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}
.cm-username {
  font-size: 13px;
  font-weight: 600;
  color: #2c2a27;
  font-family: 'Noto Sans SC', sans-serif;
}
.cm-time {
  font-size: 11px;
  color: #b8b4ae;
  font-family: 'Noto Sans SC', sans-serif;
}
.cm-content {
  font-size: 14px;
  line-height: 1.7;
  color: #3d3a36;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Noto Sans SC', sans-serif;
}

.cm-delete {
  position: absolute;
  top: 20px;
  right: 0;
  background: none;
  border: none;
  color: #ccc8c2;
  font-size: 13px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s, color 0.2s;
  padding: 4px;
}
.cm-item:hover .cm-delete { opacity: 1; }
.cm-delete:hover { color: #c0392b; }

.cm-input-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.cm-input-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cm-counter {
  font-size: 11px;
  color: #b8b4ae;
  text-align: right;
  font-family: 'Noto Sans SC', sans-serif;
  padding-right: 4px;
}
.cm-counter-over {
  color: #c0392b;
  font-weight: 600;
}
.cm-avatar-me {
  background: #c8a96e;
  color: #fff;
}
.cm-textarea {
  flex: 1;
  border: 1px solid rgba(44,42,39,0.12);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 14px;
  font-family: 'Noto Sans SC', sans-serif;
  color: #2c2a27;
  resize: none;
  outline: none;
  background: #fff;
  transition: border-color 0.2s;
  line-height: 1.6;
}
.cm-textarea:focus { border-color: #c8a96e; }
.cm-textarea::placeholder { color: #c0bcb6; }

.cm-submit {
  background: #2c2a27;
  color: #f8f5f0;
  border: none;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Noto Sans SC', sans-serif;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}
.cm-submit:hover { background: #c8a96e; }
.cm-submit:disabled { opacity: 0.4; cursor: not-allowed; }

.cm-login-hint {
  text-align: center;
  font-size: 14px;
  color: #aaa8a4;
  font-family: 'Noto Sans SC', sans-serif;
  padding: 20px 0;
}
.cm-login-hint a {
  color: #c8a96e;
  text-decoration: none;
  font-weight: 500;
}
.cm-login-hint a:hover { text-decoration: underline; }
`;
