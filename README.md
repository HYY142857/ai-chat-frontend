# AI Chat Platform — Frontend

基于 React 19 + Vite 构建的 AI 智能对话前端，与 FastAPI 后端配合，提供类 ChatGPT 的流式对话体验。

**在线地址**：https://ai-chat-frontend-lilac.vercel.app

## 技术栈

- **React 19** — UI 框架
- **Vite 8** — 构建工具
- **React Router 7** — SPA 路由
- **Axios** — HTTP 客户端
- **原生 Fetch API** — SSE 流式读取
- **纯 CSS** — 深色主题，响应式布局

## 功能

- 登录 / 注册（邀请码制）
- AI 流式对话（SSE，逐字输出）
- 多轮对话记忆
- 文件上传（PDF / Word）
- 聊天记录查看与删除
- 停止生成（AbortController）
- 移动端响应式侧边栏
- 深色主题 UI

## 本地运行

```bash
git clone https://github.com/HYY142857/ai-chat-frontend.git
cd ai-chat-frontend

npm install
npm run dev
```

开发服务器启动后访问 http://localhost:5173

## 项目结构

```
ai-chat-frontend/
├── src/
│   ├── main.jsx           # React 入口
│   ├── App.jsx            # 路由配置
│   ├── api.js             # Axios 实例 + 请求拦截器
│   ├── index.css          # 全局样式（深色主题）
│   └── components/
│       ├── Login.jsx      # 登录 / 注册页面
│       └── Chat.jsx       # 对话界面（侧边栏 + 聊天区）
├── vercel.json            # Vercel SPA 路由配置
├── package.json
└── README.md
```

## 配套后端

后端仓库：https://github.com/HYY142857/ai-chat-backend

## 部署

使用 Vercel 自动部署，推送代码到 `main` 分支即自动构建上线。

## License

MIT
