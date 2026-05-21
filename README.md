<p align="center">
  <img src=".github/header.png" alt="Ollama GUI logo">
</p>

<h1 align="center">Ollama GUI 中文版</h1>
<p align="center">一个现代化的本地大语言模型 Web 聊天界面，基于 Ollama 构建</p>

<p align="center">
  <a href="https://ollama.ai">
    <img src="https://img.shields.io/badge/Powered%20by-Ollama-blue?style=flat-square" alt="Powered by Ollama">
  </a>
  <a href="https://github.com/yangwenyu-ck/ollama-gui-zh/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
  </a>
</p>

## ✨ 功能特性

- 🖥️ 简洁现代的 Web 界面，与 Ollama 本地模型流畅对话
- 💾 基于 IndexedDB 的本地聊天记录持久化存储
- 📝 完整的 Markdown 渲染 + 代码语法高亮 + 一键复制代码
- 🌙 深色/浅色主题切换
- 🤖 多模型支持 — 自动加载本地已安装模型，每个对话可绑定不同模型
- ⚙️ 系统提示词配置 — 支持全局默认提示和按模型自定义提示
- 📊 用量分析面板 — Token 用量统计、对话次数、响应速度等可视化
- 🖥️ 推理服务监控 — 实时监控推理调用日志、运行中模型状态、VRAM 占用、速度趋势图
- 📥 对话导入/导出 — 支持 JSON 格式导入导出，方便数据备份迁移
- 🌐 OpenAI 兼容代理 — 内置代理服务器提供 OpenAI 格式 API，可对接 Trae IDE 等工具
- 🔒 隐私优先 — 所有数据存储在浏览器本地，处理完全在本地完成
- 🐳 Docker 一键部署

## 🚀 快速开始

### 环境要求

1. 安装 [Ollama](https://ollama.ai/download)
2. 安装 [Node.js](https://nodejs.org/)（v16+）和 [Yarn](https://classic.yarnpkg.com/lang/en/docs/install)

### 本地开发

```bash
# 启动 Ollama 服务并拉取模型
ollama pull mistral  # 或任意其他模型
ollama serve

# 克隆并运行 GUI
git clone https://github.com/yangwenyu-ck/ollama-gui-zh.git
cd ollama-gui-zh
yarn install
yarn dev
```

#### 局域网访问（仅开发模式）

开发服务器内置代理，可将 API 请求转发到本地 Ollama 实例，局域网内其他设备可同时访问 UI 和 API：

```bash
# 启动支持局域网访问的开发服务器
yarn dev --host

# 其他设备通过本机 IP 访问
# 例如：http://192.168.1.100:5173
```

> **注意：** 代理功能仅在 `yarn dev` 开发模式下可用。生产环境请配置 Ollama CORS 或使用反向代理。

禁用代理（例如使用自定义 Ollama 端点时）：
```bash
VITE_NO_PROXY=true yarn dev
```

### Docker 部署

Docker 方案同时运行 Ollama 和 GUI，无需额外配置代理或 CORS，只需安装 `docker` 即可。

> 如果有 NVIDIA GPU，请在 `compose.yml` 中取消以下注释：
```Dockerfile
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: all
    #           capabilities: [gpu]
```

#### 启动
```bash
docker compose up -d

# 访问 http://localhost:8080
```

#### 停止
```bash
docker compose down
```

#### 下载更多模型
```bash
# 进入 ollama 容器
docker exec -it ollama bash

# 在容器内下载模型
ollama pull <模型名称>

# 示例
ollama pull deepseek-r1:7b
```

使用 `docker compose restart` 重启容器。模型数据保存在项目目录下的 `./ollama_data` 文件夹中，可在 `compose.yml` 中修改路径。

## 🌐 OpenAI 兼容代理

项目内置了一个 Node.js 代理服务器（[proxy/server.cjs](proxy/server.cjs)），提供 OpenAI 兼容的 API 格式，可以被 Trae IDE、Continue 等工具直接调用。

```bash
# 启动代理服务
yarn proxy

# 代理端口：http://localhost:11435
# OpenAI 兼容格式：http://localhost:11435/v1/chat/completions
# 模型列表：http://localhost:11435/v1/models
```

代理服务还提供推理监控 API：
- `/monitor/stats` — 统计概览
- `/monitor/logs` — 推理日志
- `/monitor/ps` — 运行中模型
- `/monitor/speed-trend` — 速度趋势数据

## 🏭 生产部署

构建生产版本（`yarn build`）后生成静态文件，不包含代理服务器。有以下部署方案：

### 方案一：配置 Ollama CORS
```bash
OLLAMA_ORIGINS=https://your-domain.com ollama serve
```

### 方案二：使用反向代理
配置 Nginx / Apache / Caddy 将 `/api` 请求转发到 Ollama 实例。

### 方案三：使用 Docker Compose
```bash
docker compose up -d
```

## 🛣️ 路线图

- [x] 基于 IndexedDB 的聊天历史存储
- [x] Markdown 消息格式化 + 代码高亮
- [x] 深色/浅色主题切换
- [x] 多模型管理与切换
- [x] 系统提示词配置
- [x] 用量分析面板
- [x] 推理服务监控面板
- [x] 对话导入/导出
- [x] OpenAI 兼容代理服务器
- [ ] 模型库浏览与一键安装
- [ ] 移动端响应式适配
- [ ] 文件上传与 OCR 支持

## 🛠️ 技术栈

- [Vue.js 3](https://vuejs.org/) — 前端框架（Composition API + TypeScript）
- [Vite 5](https://vitejs.dev/) — 构建工具
- [Tailwind CSS](https://tailwindcss.com/) — 样式框架
- [Dexie.js](https://dexie.org/) — IndexedDB 封装
- [markdown-it](https://github.com/markdown-it/markdown-it) + [highlight.js](https://highlightjs.org/) — Markdown 渲染与代码高亮
- [VueUse](https://vueuse.org/) — Vue 组合式工具库
- [@tabler/icons-vue](https://github.com/tabler/icons-vue) — 图标库
- [Docker](https://www.docker.com/) + Nginx — 容器化部署

设计灵感来源于 [LangUI](https://www.langui.dev/)，基于 [HelgeSverre/ollama-gui](https://github.com/HelgeSverre/ollama-gui) 二次开发。

## 📄 许可证

本项目基于 [MIT 协议](LICENSE.md) 开源。
