import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState([]);
  const [username, setUsername] = useState('');
  const [notification, setNotification] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const navigate = useNavigate();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetchUser();
    fetchHistory();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUsername(res.data.username);
    } catch {
      handleLogout();
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.post('/chat/history');
      setHistory(res.data.messages || []);
    } catch {
      // silently fail
    }
  };

  const showNotification = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput('');
    const userMsg = { role: 'user', content: text };
    const aiMsg = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://ai-chat-backend-be6s.onrender.com/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
        signal: abortControllerRef.current.signal,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          accumulated += data;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: accumulated };
            return updated;
          });
        }
      }

      fetchHistory();
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '请求失败，请重试。',
          };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotification(`文件 "${res.data.filename}" 上传成功 (${formatSize(res.data.size)})`);
    } catch {
      showNotification('文件上传失败', 'error');
    }

    e.target.value = '';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleClearHistory = async () => {
    try {
      await api.delete('/chat');
      setHistory([]);
      setMessages([]);
      showNotification('聊天记录已清空');
    } catch {
      showNotification('清空失败', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const loadHistoryConversation = (item) => {
    setMessages([
      { role: 'user', content: item.message },
      { role: 'assistant', content: item.reply },
    ]);
  };

  return (
    <div className="chat-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.text}
        </div>
      )}

      {/* Sidebar */}
      <aside className={`chat-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="url(#grad2)" />
              <path d="M12 20C12 15.58 15.58 12 20 12C24.42 12 28 15.58 28 20C28 24.42 24.42 28 20 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="20" r="3" fill="white" />
              <defs>
                <linearGradient id="grad2" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <span>AI Chat</span>
          </div>
          <button className="new-chat-btn" onClick={() => setMessages([])} title="新对话">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className="sidebar-section-title">历史记录</div>

        <div className="sidebar-history">
          {history.length === 0 ? (
            <div className="sidebar-empty">暂无历史记录</div>
          ) : (
            history.map((item, idx) => (
              <button
                key={idx}
                className="history-item"
                onClick={() => loadHistoryConversation(item)}
                title={item.message}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                <span>{item.message}</span>
              </button>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-btn" onClick={handleClearHistory}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
            <span>清空记录</span>
          </button>
          <button className="sidebar-btn logout" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>退出登录</span>
          </button>
          <div className="sidebar-user">
            <div className="user-avatar">
              {username ? username.charAt(0).toUpperCase() : '?'}
            </div>
            <span>{username}</span>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        <div className="chat-topbar">
          <button
            className="toggle-sidebar-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="topbar-title">对话</span>
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <h2>开始对话</h2>
              <p>输入消息开始与 AI 助手交流</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="message-avatar ai-avatar">AI</div>
                )}
                <div className={`message-bubble ${msg.role}`}>
                  {msg.content || (isStreaming && idx === messages.length - 1 ? (
                    <span className="typing-indicator">
                      <span></span><span></span><span></span>
                    </span>
                  ) : '')}
                  {msg.role === 'assistant' && msg.content && isStreaming && idx === messages.length - 1 && (
                    <span className="cursor-blink">|</span>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="message-avatar user-avatar">
                    {username ? username.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <button
              className="input-action-btn"
              onClick={() => fileInputRef.current?.click()}
              title="上传文件"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="输入消息..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button className="send-btn stop-btn" onClick={handleStop} title="停止">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
                title="发送"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
          <div className="input-hint">按 Enter 发送，Shift + Enter 换行</div>
        </div>
      </main>
    </div>
  );
}

export default Chat;
