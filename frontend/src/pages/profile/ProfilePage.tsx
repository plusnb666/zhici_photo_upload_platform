/**
 * 赤子の相册 · Profile Page
 * 风格：Japandi 暖米白 + 灰紫 accent（私密感）
 *
 * 核心交互：
 *   - 左侧深色用户名片：大头像 + 名字 + 邮箱 + 角色徽章 + 装饰圆环
 *   - 顶部时间问候：根据当前时间自动选择「早上好/下午好/晚上好」
 *   - 存储配额：环形仪表盘 + 文件类型横条分布
 *   - 统计磁贴：上传数 / 收藏 / 浏览 / 标签（带 sparkline 趋势图）
 *   - 活动 feed：近期上传影像列表
 *   - 菜单：编辑资料 / 修改密码 / 通知设置 / 登出
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { message, Popconfirm } from 'antd';

import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api/auth';
import { imagesAPI } from '../../api/images';
import { formatFileSize, formatDate } from '../../utils/format';
import { QUOTA_GB } from '../../utils/constants';
import { spring, ease, fadeUp, staggerContainer, staggerItem } from '../../utils/motion';

/* ─── 问候语 ─── */
function useGreeting() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const greet =
    hour < 6  ? { kana: '凌 晨', en: 'late night',   cn: '夜深了' } :
    hour < 11 ? { kana: '早 上', en: 'good morning', cn: '早上好' } :
    hour < 14 ? { kana: '中 午', en: 'noontime',     cn: '中午好' } :
    hour < 18 ? { kana: '下 午', en: 'good afternoon', cn: '下午好' } :
    hour < 22 ? { kana: '晚 上', en: 'good evening', cn: '晚上好' } :
                { kana: '深 夜', en: 'late evening', cn: '夜深了' };

  const time = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  return { ...greet, time, date };
}

/* ─── 环形仪表 ─── */
function GaugeRing({ percent, label }: { percent: number; label: string }) {
  const r = 58;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - Math.min(percent, 100) / 100);

  return (
    <div className="pf-gauge">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line-3)" strokeWidth="6" />
        <motion.circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke="var(--accent-profile)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: dash }}
          transition={{ duration: 1.2, ease: ease.out as any }}
          style={{ rotate: -90, transformOrigin: '70px 70px' }}
        />
        <circle cx="70" cy="70" r="44" fill="none" stroke="rgba(184,176,192,0.15)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
      <div className="pf-gauge-c">
        <div className="pf-gauge-pct">{Math.round(percent)}%</div>
        <div className="pf-gauge-lbl">{label}</div>
      </div>
    </div>
  );
}

/* ─── Sparkline ─── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 60;
      const y = 18 - (v / max) * 16;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="pf-spark" viewBox="0 0 60 18" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <polygon points={`${points} 60,18 0,18`} fill={color} opacity="0.12" />
    </svg>
  );
}

/* ─── 主页面 ─── */
export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const greet = useGreeting();

  /* 我的图片，用于活动 feed + 文件类型统计 */
  const { data: myImagesData } = useQuery({
    queryKey: ['my-recent-images'],
    queryFn: () => imagesAPI.list({ page: 1, limit: 100, sort: 'newest' }),
  });

  const myImages = myImagesData?.data?.data?.items ?? [];
  const totalCount = myImagesData?.data?.data?.total ?? 0;

  /* 登出 */
  const logoutMutation = useMutation({
    mutationFn: async () => {
  if (refreshToken) await authAPI.logout(refreshToken);
},
    onSettled: () => {
      clearAuth();
      message.success('已登出');
      navigate('/login');
    },
  });

  if (!user) return null;

  const isAdmin = user.role === 'admin';
  const usedBytes = user.storage_used;
  const quotaBytes = QUOTA_GB * 1024 * 1024 * 1024;
  const percent = isAdmin ? Math.min((usedBytes / quotaBytes) * 100, 100) : (usedBytes / quotaBytes) * 100;

  /* 文件类型分布 */
  const typeStats = useMemo(() => {
    const groups: Record<string, { count: number; size: number }> = {};
    myImages.forEach((img: any) => {
      const ext = (img.mime_type?.split('/')[1] ?? 'other').toUpperCase();
      if (!groups[ext]) groups[ext] = { count: 0, size: 0 };
      groups[ext].count++;
      groups[ext].size += img.file_size ?? 0;
    });
    const arr = Object.entries(groups).map(([k, v]) => ({ name: k, ...v }));
    arr.sort((a, b) => b.size - a.size);
    return arr.slice(0, 4);
  }, [myImages]);

  /* 30 天上传趋势（按日聚合） */
  const trendData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      days[d.toDateString()] = 0;
    }
    myImages.forEach((img: any) => {
      const d = new Date(img.created_at).toDateString();
      if (days[d] !== undefined) days[d]++;
    });
    return Object.values(days);
  }, [myImages]);

  const maxTypeSize = Math.max(...typeStats.map(t => t.size), 1);

  return (
    <>
      <style>{profileCSS}</style>

      <motion.div
        className="pf-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: ease.out as any }}
      >
        <div className="pf-layout">

          {/* ── 左：用户名片 + 菜单 ── */}
          <motion.aside
            className="pf-side"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: ease.out as any }}
          >
            <div className="pf-ucard">
              <div className="pf-ring-1" />
              <div className="pf-ring-2" />

              <div className="pf-avatar-big">{user.username[0].toUpperCase()}</div>
              <div className="pf-uname">{user.username}</div>
              <div className="pf-umail">{user.email}</div>
              <div className={`pf-urole ${isAdmin ? 'adm' : ''}`}>
                {isAdmin ? '★ ADMINISTRATOR' : '· REGISTERED USER'}
              </div>

              <div className="pf-uquote">"keep what catches the light"</div>
            </div>

            <nav className="pf-menu">
              <button className="pf-mi on" data-cursor="hover">
                个人中心 <span className="pf-mi-r">overview</span>
              </button>
              <button className="pf-mi" data-cursor="hover" onClick={() => message.info('编辑资料：开发中')}>
                编辑资料 <span className="pf-mi-r">edit</span>
              </button>
              <button className="pf-mi" data-cursor="hover" onClick={() => message.info('修改密码：开发中')}>
                修改密码 <span className="pf-mi-r">security</span>
              </button>
              <button className="pf-mi" data-cursor="hover" onClick={() => navigate('/gallery')}>
                返回图库 <span className="pf-mi-r">gallery</span>
              </button>

              <Popconfirm
                title="确认登出？"
                onConfirm={() => logoutMutation.mutate()}
              >
                <button className="pf-mi pf-mi-danger" data-cursor="hover">
                  登出 <span className="pf-mi-r">logout</span>
                </button>
              </Popconfirm>
            </nav>
          </motion.aside>

          {/* ── 右：主区 ── */}
          <motion.main
            className="pf-main"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* 问候 */}
            <motion.div className="pf-greet" variants={staggerItem}>
              <div className="pf-greet-l">
                <p className="pf-kana">{greet.kana} · {greet.en}</p>
                <h1 className="pf-greet-h">
                  回来啦，<em>{user.username}</em>。
                </h1>
              </div>
              <div className="pf-greet-r">
                <div className="pf-time">{greet.time}</div>
                <div className="pf-date">{greet.date}</div>
              </div>
            </motion.div>

            {/* 存储配额 */}
            <motion.div className="pf-quota" variants={staggerItem}>
              <div className="pf-q-top">
                <div>
                  <p className="pf-sec-label">STORAGE QUOTA</p>
                  <h2 className="pf-sec-title">影像存储 · 配额</h2>
                </div>
                <div className="pf-q-num">
                  <span className="pf-q-used">{formatFileSize(usedBytes).split(' ')[0]}</span>
                  <small>{formatFileSize(usedBytes).split(' ')[1]}</small>
                  <span className="pf-q-quota">
                    / {isAdmin ? '∞ admin' : `${QUOTA_GB} GB`}
                  </span>
                </div>
              </div>

              <div className="pf-q-vis">
                <GaugeRing percent={percent} label="USED" />

                <div className="pf-breakdown">
                  {typeStats.length > 0 ? (
                    typeStats.map((t, i) => {
                      const colors = ['var(--accent-profile)', 'var(--gold)', 'var(--accent-gallery)', '#c9b8a8'];
                      return (
                        <motion.div
                          key={t.name}
                          className="pf-bd-row"
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 + i * 0.08, ease: ease.out as any }}
                        >
                          <div className="pf-bd-top">
                            <span className="pf-bd-name">
                              {t.name} <span>· {t.count} files</span>
                            </span>
                            <span className="pf-bd-val">{formatFileSize(t.size)}</span>
                          </div>
                          <div className="pf-bd-bar">
                            <motion.div
                              className="pf-bd-fill"
                              style={{ background: colors[i] }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(t.size / maxTypeSize) * 100}%` }}
                              transition={{ duration: 0.8, delay: 0.3 + i * 0.08, ease: ease.out as any }}
                            />
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="pf-bd-empty">暂无上传记录</div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* 统计磁贴 */}
            <motion.div className="pf-tiles" variants={staggerItem}>
              <div className="pf-tile">
                <div className="pf-tile-label">UPLOADED</div>
                <div className="pf-tile-val">{totalCount}</div>
                <Sparkline data={trendData} color="var(--gold)" />
              </div>
              <div className="pf-tile">
                <div className="pf-tile-label">FILE TYPES</div>
                <div className="pf-tile-val">{typeStats.length}</div>
                <Sparkline data={[2, 3, 3, 4, 4, 5, typeStats.length || 1]} color="var(--accent-gallery)" />
              </div>
              <div className="pf-tile">
                <div className="pf-tile-label">STORAGE</div>
                <div className="pf-tile-val">
                  {formatFileSize(usedBytes).split(' ')[0]}
                  <small>{formatFileSize(usedBytes).split(' ')[1]}</small>
                </div>
                <Sparkline data={[5, 8, 12, 18, 25, 30, percent || 1]} color="var(--accent-profile)" />
              </div>
              <div className="pf-tile">
                <div className="pf-tile-label">ROLE</div>
                <div className="pf-tile-val pf-role-val">
                  {isAdmin ? '★' : '○'}
                </div>
                <div className="pf-role-text">
                  {isAdmin ? 'Administrator' : 'User'}
                </div>
              </div>
            </motion.div>

            {/* 近期影像 */}
            <motion.div variants={staggerItem}>
              <div className="pf-feed-head">
                <h3>近期影像 <em>· recent uploads</em></h3>
                <button className="pf-feed-link" onClick={() => navigate('/gallery?mine=1')} data-cursor="hover">
                  查看全部 →
                </button>
              </div>

              {myImages.length === 0 ? (
                <div className="pf-feed-empty">
                  <span>暂无上传记录</span>
                  <button onClick={() => navigate('/upload')} data-cursor="hover">+ 上传第一张</button>
                </div>
              ) : (
                <div className="pf-feed">
                  {myImages.slice(0, 6).map((img: any, i: number) => {
                    const date = new Date(img.created_at);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = date.toLocaleString('en', { month: 'short' }).toUpperCase();
                    return (
                      <motion.div
                        key={img.id}
                        className="pf-fi"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.05 }}
                        onClick={() => navigate(`/gallery/${img.id}`)}
                        data-cursor="hover"
                      >
                        <div className="pf-fi-d">
                          <strong>{day}</strong>
                          {month} {date.getFullYear()}
                        </div>
                        <div className="pf-fi-t">
                          上传了 <em>{img.filename}</em>
                          <span className="pf-fi-meta">· {formatFileSize(img.file_size)}</span>
                        </div>
                        <div className="pf-fi-thumb">
                          <img src={img.thumbnail_url || img.url} alt="" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.main>
        </div>
      </motion.div>
    </>
  );
}

/* ─── CSS ─── */
const profileCSS = `
.pf-root {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--ink-1);
  font-family: var(--font-sans);
  padding: 40px;
}
.pf-layout {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 36px;
  align-items: start;
}

/* ── 用户名片 ── */
.pf-side { display: flex; flex-direction: column; gap: 20px; }
.pf-ucard {
  background: var(--ink-1);
  color: var(--bg-primary);
  border-radius: var(--radius-md);
  padding: 32px 24px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.pf-ring-1 {
  position: absolute;
  left: -30px;
  top: -30px;
  width: 120px;
  height: 120px;
  border: 1px solid rgba(184, 176, 192, 0.3);
  border-radius: 50%;
}
.pf-ring-2 {
  position: absolute;
  right: -40px;
  bottom: -40px;
  width: 140px;
  height: 140px;
  border: 1px solid rgba(184, 176, 192, 0.2);
  border-radius: 50%;
}
.pf-avatar-big {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: var(--accent-profile);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mincho);
  font-size: 38px;
  margin: 0 auto 14px;
  position: relative;
  z-index: 2;
}
.pf-uname {
  font-family: var(--font-mincho);
  font-size: 18px;
  letter-spacing: 0.06em;
  position: relative;
  z-index: 2;
}
.pf-umail {
  font-size: 11px;
  color: rgba(248,245,240,0.55);
  font-family: var(--font-garamond);
  font-style: italic;
  margin-top: 4px;
  word-break: break-all;
}
.pf-urole {
  display: inline-block;
  margin-top: 14px;
  padding: 3px 12px;
  border: 1px solid rgba(184, 176, 192, 0.5);
  color: rgba(184, 176, 192, 0.85);
  font-size: 9px;
  letter-spacing: 0.18em;
  border-radius: var(--radius-full);
  position: relative;
  z-index: 2;
}
.pf-urole.adm {
  border-color: var(--gold);
  color: var(--gold);
}
.pf-uquote {
  margin-top: 18px;
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: rgba(248,245,240,0.45);
  line-height: 1.6;
  position: relative;
  z-index: 2;
}

/* ── 菜单 ── */
.pf-menu { display: flex; flex-direction: column; gap: 2px; }
.pf-mi {
  padding: 10px 14px;
  font-size: 12px;
  color: var(--ink-3);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-sans);
  text-align: left;
  transition: background var(--dur-fast) var(--ease-out);
}
.pf-mi:hover { background: var(--line-4); }
.pf-mi.on {
  background: var(--line-4);
  color: var(--ink-1);
}
.pf-mi-r {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 11px;
  color: var(--ink-5);
}
.pf-mi-danger { color: #a83a30; }
.pf-mi-danger .pf-mi-r { color: rgba(168, 58, 48, 0.5); }

/* ── 主区 ── */
.pf-main { display: flex; flex-direction: column; gap: 24px; }

/* 问候 */
.pf-greet {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line-3);
  gap: 16px;
  flex-wrap: wrap;
}
.pf-kana {
  font-family: var(--font-mincho);
  font-size: 10px;
  letter-spacing: 0.3em;
  color: var(--accent-profile);
}
.pf-greet-h {
  font-family: var(--font-mincho);
  font-size: 26px;
  margin-top: 6px;
}
.pf-greet-h em {
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--accent-profile);
}
.pf-greet-r { text-align: right; }
.pf-time {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 32px;
  color: var(--ink-1);
  line-height: 1;
}
.pf-date {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 12px;
  color: var(--ink-4);
  margin-top: 4px;
}

/* 存储配额 */
.pf-quota {
  background: var(--bg-elevated);
  border: 1px solid var(--line-3);
  border-radius: var(--radius-md);
  padding: 24px;
}
.pf-q-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
  gap: 16px;
  flex-wrap: wrap;
}
.pf-sec-label {
  font-family: var(--font-garamond);
  font-size: 10px;
  letter-spacing: 0.22em;
  color: var(--ink-4);
  text-transform: uppercase;
}
.pf-sec-title {
  font-family: var(--font-mincho);
  font-size: 18px;
  margin-top: 4px;
}
.pf-q-num {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 32px;
  line-height: 1;
}
.pf-q-used { color: var(--ink-1); }
.pf-q-num small {
  font-size: 14px;
  color: var(--ink-4);
  margin-left: 4px;
}
.pf-q-quota {
  font-size: 14px;
  color: var(--ink-5);
  margin-left: 8px;
}

.pf-q-vis {
  display: flex;
  gap: 28px;
  align-items: center;
  flex-wrap: wrap;
}
.pf-gauge {
  width: 140px;
  height: 140px;
  flex-shrink: 0;
  position: relative;
}
.pf-gauge-c {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.pf-gauge-pct {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 28px;
  line-height: 1;
}
.pf-gauge-lbl {
  font-size: 9px;
  letter-spacing: 0.22em;
  color: var(--ink-4);
  margin-top: 4px;
  font-family: var(--font-garamond);
}

.pf-breakdown {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pf-bd-row { font-size: 11px; }
.pf-bd-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.pf-bd-name { color: var(--ink-2); }
.pf-bd-name span {
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--ink-4);
  margin-left: 6px;
}
.pf-bd-val {
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--ink-4);
}
.pf-bd-bar {
  height: 4px;
  background: var(--line-3);
  border-radius: 2px;
  overflow: hidden;
}
.pf-bd-fill { height: 100%; border-radius: 2px; }
.pf-bd-empty {
  text-align: center;
  color: var(--ink-5);
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 12px;
  padding: 14px;
}

/* 统计磁贴 */
.pf-tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.pf-tile {
  background: var(--bg-elevated);
  border: 1px solid var(--line-3);
  border-radius: var(--radius-sm);
  padding: 14px 14px 0;
  position: relative;
  overflow: hidden;
}
.pf-tile-label {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--ink-4);
  text-transform: uppercase;
  font-family: var(--font-garamond);
}
.pf-tile-val {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 28px;
  margin-top: 6px;
  line-height: 1.1;
}
.pf-tile-val small {
  font-size: 13px;
  color: var(--ink-4);
  margin-left: 3px;
}
.pf-role-val { color: var(--gold); }
.pf-role-text {
  font-size: 11px;
  color: var(--ink-3);
  font-family: var(--font-garamond);
  font-style: italic;
}
.pf-spark {
  margin-top: 6px;
  width: 100%;
  height: 18px;
  display: block;
}

/* 活动 feed */
.pf-feed-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}
.pf-feed-head h3 {
  font-family: var(--font-mincho);
  font-size: 14px;
  letter-spacing: 0.06em;
}
.pf-feed-head em {
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--ink-4);
  font-size: 12px;
  margin-left: 6px;
}
.pf-feed-link {
  font-size: 11px;
  color: var(--ink-4);
  background: none;
  border: none;
  font-family: var(--font-garamond);
  font-style: italic;
  transition: color var(--dur-fast) var(--ease-out);
}
.pf-feed-link:hover { color: var(--ink-1); }

.pf-feed { display: flex; flex-direction: column; }
.pf-fi {
  display: grid;
  grid-template-columns: 70px 1fr 40px;
  gap: 14px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--line-3);
  font-size: 12px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out);
}
.pf-fi:hover { background: var(--line-4); }
.pf-fi-d {
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--ink-4);
  font-size: 11px;
}
.pf-fi-d strong {
  display: block;
  color: var(--ink-1);
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
}
.pf-fi-t { color: var(--ink-2); }
.pf-fi-t em {
  font-style: normal;
  color: var(--accent-profile);
  font-weight: 500;
}
.pf-fi-meta {
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--ink-4);
  font-size: 10px;
  margin-left: 6px;
}
.pf-fi-thumb {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-secondary);
  justify-self: end;
}
.pf-fi-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pf-feed-empty {
  padding: 40px;
  text-align: center;
  border: 1px dashed var(--line-3);
  border-radius: var(--radius-sm);
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 13px;
  color: var(--ink-4);
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}
.pf-feed-empty button {
  background: var(--ink-1);
  color: var(--bg-primary);
  border: none;
  padding: 8px 20px;
  font-size: 12px;
  letter-spacing: 0.06em;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-style: normal;
}

@media (max-width: 900px) {
  .pf-root { padding: 20px; }
  .pf-layout { grid-template-columns: 1fr; }
  .pf-tiles { grid-template-columns: repeat(2, 1fr); }
}
`;
