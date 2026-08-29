# 三合一资产管理工作台 · 架构图

> **DSH = AI 大脑 · OpenAlice = 交易工作台界面 · Fincept = 金融数据后端**
>
> 以下图表为 Mermaid，可在支持 Mermaid 的前端直接渲染。

---

## 一、整体分层

```mermaid
flowchart TB
    subgraph USER["👤 用户访问层"]
        DEVICE["📱 手机 / 💻 电脑浏览器"]
    end

    subgraph DSH["🧠 DSH · AI 大脑（宿主）:3080"]
        CORE["DSH Web 运行时\nCordis 插件 + React 客户端"]
        P1["🔌 dsh-openalice 插件 ✅\n侧边栏入口 + 面板嵌入"]
        P2["🔌 dsh-fincept 插件 ⏳\n接 83 个数据工具"]
    end

    subgraph OPENALICE["📊 OpenAlice · 交易工作台"]
        GUARD["🛡️ Guardian 进程总管"]
        ALICE["Alice 主进程 :47331/47332/5173\nWorkspace · Issue · Inbox · ToolCenter"]
        UTA["UTA 交易权威\n⏸️ lite 模式未启用"]
        CLIS["🤖 原生 Agent CLI\nclaude / codex / opencode / pi"]
    end

    subgraph FINCEPT["📡 Fincept · 金融数据后端"]
        MCP["83 个 MCP 数据工具"]
    end

    MODEL["🌐 外部模型服务"]

    DEVICE -->|隧道/直连| CORE
    CORE --> P1
    CORE --> P2
    P1 -->|iframe 嵌入| ALICE
    GUARD --> ALICE
    GUARD --> UTA
    ALICE -->|拉起进程| CLIS
    CLIS -->|注入凭证| MODEL
    P2 -.->|规划中| MCP
    MCP -.->|供数| ALICE

    style USER fill:#e3f2fd,stroke:#1976D2
    style DSH fill:#fff3e0,stroke:#F57C00
    style OPENALICE fill:#f3e5f5,stroke:#7B1FA2
    style FINCEPT fill:#e8f5e9,stroke:#388E3C
    style MODEL fill:#fce4ec,stroke:#C2185B
```

---

## 二、关键数据流

```mermaid
sequenceDiagram
    participant U as 👤 用户
    participant D as 🧠 DSH :3080
    participant A as 📊 OpenAlice
    participant C as 🤖 claude CLI
    participant M as 🌐 模型服务

    U->>D: 打开 DSH，点「◈ OpenAlice」
    D->>A: 插件加载 iframe(localhost:5173)
    A-->>U: 显示交易工作台界面
    U->>A: 在 Chat 提问
    A->>C: 拉起 claude CLI（注入凭证+模型）
    C->>M: 调用模型
    M-->>C: 返回回答
    C-->>A: 结果写回工作区 / Inbox
    A-->>U: 显示对话 / 报告
```

---

## 三、端口与进程清单

| 组件 | 端口 | 绑定 | 状态 |
|---|---|---|---|
| 🧠 DSH Web | **3080** | 本机 | ✅ |
| 📊 OpenAlice 前端（Vite） | **5173** | 仅 127.0.0.1 | ✅ |
| 📊 OpenAlice 后端 API | **47331** | 仅 127.0.0.1 | ✅ |
| 📊 OpenAlice 工具网关 | **47332** | 仅 127.0.0.1 | ✅ |
| 📊 UTA 交易 | — | — | ⏸️ lite 模式未启用 |

---

## 四、角色分工一句话

| 组件 | 角色 | 负责 |
|---|---|---|
| **DSH** | 大脑 + 宿主 | 想（Agent 推理、任务编排） |
| **OpenAlice** | 工作台界面 | 摆（工作区 / 任务 / 审批 / 报告） |
| **Fincept** | 数据后端 | 喂（行情 / 基本面 / 宏观） |

---

## 五、进度快照

| 项 | 状态 |
|---|---|
| DSH + OpenAlice 运行（已安全加固） | ✅ |
| dsh-openalice 插件（嵌入） | ✅ |
| OpenAlice Chat（claude + grok-4.5） | ✅ 底层已通 |
| **dsh-fincept 数据桥接** | ⏳ 下一步重点 |
| UTA 真交易（接券商） | ⏳ 未启用 |
| 架构方向定稿（DSH 为主） | ⏳ 待确认 |
