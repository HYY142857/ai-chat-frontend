import { useState } from 'react';
import api from '../api';

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setMessageType('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', { username, password });
        localStorage.setItem('token', res.data.token);
        window.location.href = '/chat';
      } else {
        await api.post('/auth/register', { username, password, invite_code: inviteCode });
        setMessageType('success');
        setMessage('注册成功！请登录。');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.detail || '操作失败，请重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#grad)" />
              <path d="M12 20C12 15.58 15.58 12 20 12C24.42 12 28 15.58 28 20C28 24.42 24.42 28 20 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="20" r="3" fill="white" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1>AI Chat</h1>
          <p className="auth-subtitle">智能对话助手</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(true); setMessage(''); }}
          >
            登录
          </button>
          <button
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => { setIsLogin(false); setMessage(''); }}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">密码</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          {!isLogin && (
            <div className="input-group">
              <label htmlFor="inviteCode">邀请码</label>
              <input
                id="inviteCode"
                type="text"
                placeholder="请输入邀请码"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
              />
            </div>
          )}

          {message && (
            <div className={`auth-message ${messageType}`}>
              {message}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <span className="spinner" />
            ) : (
              isLogin ? '登录' : '注册'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
