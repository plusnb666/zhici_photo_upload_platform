/**
 * 赤子の相册 · Login & Register Page
 * 风格：Japandi 暖米白 + 朱印红 accent（落款感）
 *
 * 设计：
 *   - 左侧深色品牌区：标题逐字浮现（stagger）+ 右下角「赤」字印章
 *   - 右侧表单区：登录/注册 tab 用金色下划线滑动切换
 *   - 输入框：无边框底线风格，聚焦时底线从左展开（cubic-bezier）
 *   - 提交按钮：hover 时朱红背景从左滑入
 *   - 登录/注册共用同一个页面组件，通过 mode prop 区分
 *   - 错误提示：红色摇动动画
 */

import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI } from '../../api/auth';
import type { LoginParams, RegisterParams } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { spring, ease } from '../../utils/motion';

/* ─── 逐字动效 ─── */
function AnimatedChars({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          style={{ display: 'inline-block' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: delay + i * 0.06,
            ease: ease.out as any,
          }}
        >
          {ch === ' ' ? '\u00a0' : ch}
        </motion.span>
      ))}
    </>
  );
}

/* ─── 单个输入框 ─── */
function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const isPwd = type === 'password';

  return (
    <div className="au-field">
      <label className="au-label">{label}</label>
      <div className="au-input-wrap">
        <input
          className={`au-input ${error ? 'err' : ''}`}
          type={isPwd && !showPwd ? 'password' : 'text'}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <motion.span
          className="au-input-line"
          animate={{ scaleX: focused ? 1 : 0 }}
          style={{ originX: 0 }}
          transition={{ duration: 0.4, ease: [0.7, 0.1, 0.3, 1] as any }}
        />
        {isPwd && (
          <button
            type="button"
            className="au-eye"
            onClick={() => setShowPwd(s => !s)}
            tabIndex={-1}
          >
            {showPwd ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            className="au-field-err"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────
 *  LoginPage
 * ───────────────────────────────────────── */
export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email) e.email = '请输入邮箱';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = '邮箱格式不正确';
    if (!password) e.password = '请输入密码';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      const { access_token, refresh_token, user } = res.data.data;
      setAuth(access_token, refresh_token, user as any);
      navigate('/gallery');
    } catch (err: any) {
      setErrors({ form: err.response?.data?.message || '邮箱或密码错误' });
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout mode="login" shake={shake}>
      <form className="au-form" onSubmit={handleSubmit} noValidate>
        <Field label="Email" type="email" value={email} onChange={setEmail}
          placeholder="you@example.com" error={errors.email} />
        <Field label="Password" type="password" value={password} onChange={setPassword}
          placeholder="••••••••" error={errors.password} />

        <AnimatePresence>
          {errors.form && (
            <motion.p
              className="au-form-err"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >{errors.form}</motion.p>
          )}
        </AnimatePresence>

        <motion.button
          className="au-submit"
          type="submit"
          disabled={loading}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={spring.soft}
          data-cursor="hover"
        >
          <span>{loading ? '登录中…' : '登 录 →'}</span>
        </motion.button>

        <div className="au-switch">
          还没有账号？
          <Link to="/register" className="au-switch-link" data-cursor="hover">
            立即注册
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

/* ─────────────────────────────────────────
 *  RegisterPage
 * ───────────────────────────────────────── */
export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!username || username.length < 2) e.username = '用户名至少 2 个字符';
    if (!email) e.email = '请输入邮箱';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = '邮箱格式不正确';
    if (!password || password.length < 6) e.password = '密码至少 6 位';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await authAPI.register({ username, email, password });
      navigate('/login');
    } catch (err: any) {
      setErrors({ form: err.response?.data?.message || '注册失败，请稍后重试' });
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout mode="register" shake={shake}>
      <form className="au-form" onSubmit={handleSubmit} noValidate>
        <Field label="Username" value={username} onChange={setUsername}
          placeholder="你的昵称" error={errors.username} />
        <Field label="Email" type="email" value={email} onChange={setEmail}
          placeholder="you@example.com" error={errors.email} />
        <Field label="Password" type="password" value={password} onChange={setPassword}
          placeholder="至少 6 位" error={errors.password} />

        <AnimatePresence>
          {errors.form && (
            <motion.p
              className="au-form-err"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >{errors.form}</motion.p>
          )}
        </AnimatePresence>

        <motion.button
          className="au-submit"
          type="submit"
          disabled={loading}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={spring.soft}
          data-cursor="hover"
        >
          <span>{loading ? '注册中…' : '注 册 →'}</span>
        </motion.button>

        <div className="au-switch">
          已有账号？
          <Link to="/login" className="au-switch-link" data-cursor="hover">
            立即登录
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

/* ─────────────────────────────────────────
 *  共用布局：左品牌区 + 右表单区
 * ───────────────────────────────────────── */
function AuthLayout({
  mode,
  shake,
  children,
}: {
  mode: 'login' | 'register';
  shake: boolean;
  children: React.ReactNode;
}) {
  const isLogin = mode === 'login';

  return (
    <>
      <style>{authCSS}</style>

      <motion.div
        className="au-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: ease.out as any }}
      >
        {/* ── 左：品牌区 ── */}
        <div className="au-brand">
          {/* 纸纹 */}
          <div className="au-brand-grain" />

          <div className="au-brand-top">
            <span className="au-brand-logo">赤子の相册</span>
            <a href="/" className="au-brand-back" data-cursor="hover">← 返回首页</a>
          </div>

          <div className="au-brand-mid">
            <motion.p
              className="au-brand-kana"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: ease.out as any }}
            >
              {isLogin ? '归 来 · 或 是 启 程' : '加 入 · 赤 子 后 花 园'}
            </motion.p>

            <h1 className="au-brand-title">
              {isLogin ? (
                <>
                  <div><AnimatedChars text="登入这座" delay={0.2} /></div>
                  <div>
                    <AnimatedChars text="影像的" delay={0.55} />
                    <em><AnimatedChars text="后花园" delay={0.8} /></em>
                    <AnimatedChars text="。" delay={1.1} />
                  </div>
                </>
              ) : (
                <>
                  <div><AnimatedChars text="留下你的" delay={0.2} /></div>
                  <div>
                    <AnimatedChars text="第一帧" delay={0.55} />
                    <em><AnimatedChars text="印记" delay={0.8} /></em>
                    <AnimatedChars text="。" delay={1.05} />
                  </div>
                </>
              )}
            </h1>

            <motion.p
              className="au-brand-quote"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.3 }}
            >
              {isLogin
                ? '"Memory is the seamstress, and a capricious one at that."'
                : '"Every artist was first an amateur."'
              }
              <br />
              <em>
                {isLogin ? '— Virginia Woolf, Orlando' : '— Ralph Waldo Emerson'}
              </em>
            </motion.p>
          </div>

          <div className="au-brand-bot">
            <span>EST. 2025</span>
            <span>赤 子 剧 社</span>
          </div>

          {/* 印章 */}
          <motion.div
            className="au-seal"
            initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
            animate={{ opacity: 0.18, scale: 1, rotate: -12 }}
            transition={{ duration: 1, delay: 0.8, ease: ease.out as any }}
          >
            <div className="au-seal-inner">赤</div>
          </motion.div>
        </div>

        {/* ── 右：表单区 ── */}
        <motion.div
          className="au-form-panel"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: ease.out as any }}
        >
          {/* Tab 指示器 */}
          <div className="au-tabs">
            <Link
              to="/login"
              className={`au-tab ${isLogin ? 'on' : ''}`}
              data-cursor="hover"
            >登 录</Link>
            <Link
              to="/register"
              className={`au-tab ${!isLogin ? 'on' : ''}`}
              data-cursor="hover"
            >注 册</Link>
            <motion.div
              className="au-tab-bar"
              animate={{ x: isLogin ? 0 : 80 }}
              transition={spring.default}
            />
          </div>

          {/* 表单内容（错误时抖动）*/}
          <motion.div
            animate={shake ? { x: [0, -8, 8, -6, 6, -4, 4, 0] } : {}}
            transition={{ duration: 0.45 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: ease.out as any }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>
    </>
  );
}

/* ─── CSS ─── */
const authCSS = `
.au-root {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--bg-primary);
  color: var(--ink-1);
  font-family: var(--font-sans);
}

/* ── 左品牌区 ── */
.au-brand {
  background: var(--ink-1);
  color: var(--bg-primary);
  padding: 36px 40px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
}
.au-brand-grain {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1px 1px, rgba(248,245,240,0.04) 1px, transparent 0);
  background-size: 3px 3px;
  pointer-events: none;
}
.au-brand-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 2;
}
.au-brand-logo {
  font-family: var(--font-mincho);
  font-size: 16px;
  letter-spacing: 0.08em;
}
.au-brand-back {
  font-size: 11px;
  color: rgba(248,245,240,0.55);
  letter-spacing: 0.06em;
  text-decoration: none;
  transition: color var(--dur-fast) var(--ease-out);
}
.au-brand-back:hover { color: var(--bg-primary); }

.au-brand-mid {
  position: relative;
  z-index: 2;
}
.au-brand-kana {
  font-family: var(--font-mincho);
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--accent-auth);
  margin-bottom: 14px;
}
.au-brand-title {
  font-family: var(--font-mincho);
  font-size: clamp(36px, 4vw, 54px);
  font-weight: 500;
  line-height: 1.2;
  margin-bottom: 20px;
}
.au-brand-title em {
  font-family: var(--font-garamond);
  font-style: italic;
  color: var(--accent-auth);
}
.au-brand-quote {
  font-family: var(--font-garamond);
  font-style: italic;
  font-size: 12px;
  color: rgba(248,245,240,0.45);
  line-height: 1.8;
}
.au-brand-quote em {
  font-style: normal;
  color: rgba(248,245,240,0.35);
}

.au-brand-bot {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: rgba(248,245,240,0.3);
  letter-spacing: 0.12em;
  position: relative;
  z-index: 2;
}

/* 印章 */
.au-seal {
  position: absolute;
  right: -50px;
  bottom: -50px;
  width: 240px;
  height: 240px;
  border: 2px solid var(--accent-auth);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.au-seal::before {
  content: '';
  position: absolute;
  inset: 14px;
  border: 1px solid var(--accent-auth);
  border-radius: 50%;
}
.au-seal-inner {
  font-family: var(--font-mincho);
  font-size: 72px;
  color: var(--accent-auth);
  letter-spacing: 0;
}

/* ── 右表单区 ── */
.au-form-panel {
  padding: 60px 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* tabs */
.au-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 36px;
  border-bottom: 1px solid var(--line-2);
  position: relative;
}
.au-tab {
  padding: 10px 0;
  margin-right: 32px;
  font-family: var(--font-mincho);
  font-size: 14px;
  letter-spacing: 0.1em;
  color: var(--ink-4);
  text-decoration: none;
  position: relative;
  z-index: 1;
  transition: color var(--dur-fast) var(--ease-out);
}
.au-tab.on { color: var(--ink-1); }
.au-tab-bar {
  position: absolute;
  bottom: -1px;
  left: 0;
  height: 2px;
  width: 36px;
  background: var(--accent-auth);
  z-index: 2;
}

/* form */
.au-form {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.au-field { display: flex; flex-direction: column; gap: 6px; }
.au-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--ink-4);
  font-family: var(--font-garamond);
  font-style: italic;
  text-transform: uppercase;
}
.au-input-wrap { position: relative; }
.au-input {
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid var(--line-2);
  padding: 9px 32px 9px 0;
  font-size: 14px;
  color: var(--ink-1);
  font-family: var(--font-sans);
  outline: none;
}
.au-input::placeholder { color: var(--ink-5); }
.au-input.err { border-bottom-color: var(--accent-auth); }
.au-input-line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1.5px;
  background: var(--ink-1);
  transform-origin: left;
}
.au-eye {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--ink-4);
  padding: 4px;
  transition: color var(--dur-fast) var(--ease-out);
}
.au-eye:hover { color: var(--ink-1); }
.au-field-err {
  font-size: 11px;
  color: var(--accent-auth);
  font-family: var(--font-garamond);
  font-style: italic;
}
.au-form-err {
  font-size: 12px;
  color: var(--accent-auth);
  font-family: var(--font-garamond);
  font-style: italic;
  padding: 8px 12px;
  border: 1px solid rgba(168, 58, 48, 0.25);
  border-radius: var(--radius-sm);
  background: rgba(168, 58, 48, 0.04);
}

/* submit */
.au-submit {
  position: relative;
  overflow: hidden;
  background: var(--ink-1);
  color: var(--bg-primary);
  border: none;
  padding: 13px;
  font-size: 13px;
  letter-spacing: 0.18em;
  font-family: var(--font-sans);
  border-radius: var(--radius-sm);
  margin-top: 4px;
  transition: background var(--dur-normal) var(--ease-out);
}
.au-submit::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--accent-auth);
  transform: translateX(-101%);
  transition: transform var(--dur-normal) cubic-bezier(0.7, 0.1, 0.3, 1);
}
.au-submit:hover::before { transform: translateX(0); }
.au-submit span { position: relative; z-index: 1; }
.au-submit:disabled { opacity: 0.6; }

.au-switch {
  text-align: center;
  font-size: 12px;
  color: var(--ink-4);
  margin-top: -6px;
}
.au-switch-link {
  color: var(--ink-1);
  text-decoration: none;
  border-bottom: 1px solid var(--accent-auth);
  margin-left: 4px;
  transition: color var(--dur-fast) var(--ease-out);
}
.au-switch-link:hover { color: var(--accent-auth); }

/* responsive */
@media (max-width: 768px) {
  .au-root { grid-template-columns: 1fr; }
  .au-brand { display: none; }
  .au-form-panel { padding: 40px 24px; justify-content: flex-start; padding-top: 80px; }
}
`;
