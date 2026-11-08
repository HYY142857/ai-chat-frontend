import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import ReactMarkdown from 'react-markdown';

function fixMarkdown(text) {
  if (!text) return text;
  return text.replace(/^(#{1,6})(?=\S)/gm, '$1 ');
}

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversations, setConversations] = useState([]);  // 改：会话列表
  const [activeConvId, setActiveConvId] = useState(null); // 新增：当前会话ID
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

  // 页面加载：拿用户信息 + 会话列表（不再直接拉消息）
  useEffect(() => {
    fetchUser();
    fetchConversations();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUsername(res.data.username);
    } catch {
      handleLogout();
    }
  };

  // 新增：获取会话列表（替换旧的 fetchHistory）
  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data.conversations || []);
    } catch {
      // 旧版本后端兼容：如果新接口没有，就跳过
    }
  };

  // 新增：点左侧会话时，加载这个会话的所有消息
  const loadConversation = async (convId) => {
    try {
      const res = await api.get(`/chat/conversations/${convId}/messages`);
      const records = res.data.messages || [];
      const loaded = [];
      records.forEach((item) => {
        loaded.push({ role: 'user', content: item.message });
        loaded.push({ role: 'assistant', content: item.reply });
      });
      setMessages(loaded);
      setActiveConvId(convId);
    } catch (err) {
      console.error('加载会话失败:', err);
    }
  };

  // 新增：新建空会话（左侧点 + 号）
  const handleNewChat = async () => {
    setMessages([]);            // 清空聊天区
    setActiveConvId(null);      // 表示没有选会话，等用户发第一条消息时自动创建
    // 不调后端创建空会话，让后端在发第一条消息时自动创建
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

      // 构造请求体：有 activeConvId 就传，没有就不传（后端会自动新建会话）
      const body = { message: text };
      if (activeConvId) {
        body.conversation_id = activeConvId;
      }

      const response = await fetch('https://ai-chat-backend-be6s.onrender.com/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
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

      // 发送完成后，刷新会话列表，并把当前 activeConvId 设好
      const convRes = await api.get('/chat/conversations');
      const newConvs = convRes.data.conversations || [];
      setConversations(newConvs);

      // 如果之前没有 activeConvId（说明是新建会话的第一条消息），
      // 直接用刚拿到的 newConvs 里最新那个
      if (!activeConvId && newConvs.length > 0) {
        setActiveConvId(newConvs[0].id);
      }
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        let errorMsg = '请求失败，请重试。';
        if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
          errorMsg = '网络连接失败，请检查网络后重试。';
        }
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: errorMsg,
            type: 'error',
          };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
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
      setMessages((prev) => [...prev, {
        role: 'user',
        type: 'file',
        filename: res.data.filename,
        size: res.data.size,
      }]);
    } catch (err) {
      const detail = err.response?.data?.detail || '文件上传失败，请重试';
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: detail,
        type: 'error',
      }]);
    }

    e.target.value = '';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 修改：删除单个会话（带 conversation_id）
  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/conversations/${convId}`);
      await fetchConversations();
      if (activeConvId === convId) {
        setMessages([]);
        setActiveConvId(null);
      }
      showNotification('会话已删除');
    } catch {
      showNotification('删除失败', 'error');
    }
  };

  // 新增：清空所有会话（循环调删除，或者后端加一个清空全部接口）
  const handleClearAll = async () => {
    if (!conversations.length) return;
    try {
      // 一个个删，简单直接
      for (const c of conversations) {
        await api.delete(`/chat/conversations/${c.id}`);
      }
      setConversations([]);
      setMessages([]);
      setActiveConvId(null);
      showNotification('已清空所有会话');
    } catch {
      showNotification('清空失败', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  return (
    <div className="chat-container">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.text}
        </div>
      )}

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
          {/* 修改：点 + 号 = 新建空会话 */}
          <button className="new-chat-btn" onClick={handleNewChat} title="新对话">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className="sidebar-section-title">对话</div>

        {/* 修改：左侧栏显示会话列表，不再显示消息列表 */}
        <div className="sidebar-history">
          {conversations.length === 0 ? (
            <div className="sidebar-empty">暂无对话，点 + 开始</div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                className={`history-item ${activeConvId === conv.id ? 'active' : ''}`}
                onClick={() => loadConversation(conv.id)}
                title={conv.title}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                <div className="conv-info">
                  <span className="conv-title">{conv.title}</span>
                  <span className="conv-preview">{conv.preview}</span>
                </div>
                {/* 新增：每个会话旁边有删除按钮 */}
                <button
                  className="conv-delete-btn"
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  title="删除这个会话"
                >
                  ✕
                </button>
              </button>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-btn" onClick={handleClearAll}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
            <span>清空所有</span>
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

      <div
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <main
        className="chat-main"
        onClick={() => { if (sidebarOpen) setSidebarOpen(false); }}
      >
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
          {/* 修改：显示当前选中的会话标题 */}
          <span className="topbar-title">
            {activeConvId
              ? (conversations.find(c => c.id === activeConvId)?.title || '对话')
              : '新对话'}
          </span>
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
                {msg.type === 'file' ? (
                  <div className="message-bubble user file-card">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div className="file-info">
                      <span className="file-name">{msg.filename}</span>
                      <span className="file-size">{formatSize(msg.size)}</span>
                    </div>
                    <span className="file-badge">已加载</span>
                  </div>
                ) : (
                  <div className={`message-bubble ${msg.role} ${msg.type === 'error' ? 'error-msg' : ''}`}>
                    {msg.content ? (
                      msg.role === 'assistant' ? (
                        <ReactMarkdown>{fixMarkdown(msg.content)}</ReactMarkdown>
                      ) : msg.content
                    ) : (isStreaming && idx === messages.length - 1 ? (
                      <span className="typing-indicator">
                        <span></span><span></span><span></span>
                      </span>
                    ) : '')}
                    {msg.role === 'assistant' && msg.content && isStreaming && idx === messages.length - 1 && (
                      <span className="cursor-blink">|</span>
                    )}
                </div>
                )}
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