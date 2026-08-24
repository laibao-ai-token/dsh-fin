# dsh-finance-workbench

DSH + OpenAlice + FinceptTerminal 融合工作台 —— 集成层仓库。

## 定位

- **DSH**（@deepseek-ai/dsh）：Agent 宿主，只通过插件机制扩展，**不改 DSH 本体源码**
- **OpenAlice**：金融工作台前端，嵌进 DSH 的 details 面板
- **FinceptTerminal**：金融数据 MCP 工具源（83 个工具）

## 目录结构

```
plugins/
  dsh-openalice/     ← DSH 插件：侧边栏入口 + details 面板嵌 OpenAlice
deploy/              ← nginx 配置、部署脚本
docs/                ← 集成文档
```

## 源码参考（不在本仓库）

| 项目 | 位置 | 用途 |
|---|---|---|
| DSH 源码 | /home/deepseek-harness | 只读参考（插件 API / 槽位契约） |
| OpenAlice | /home/OpenAlice/OpenAlice | 前端工作台，本地分支 dsh-integration |
| FinceptTerminal | /home/FinceptTerminal | 金融数据，origin=我的 fork |

## 插件部署

插件通过符号链接挂载到 DSH profile：

```
/root/.dsh/profiles/web/node_modules/@local/dsh-openalice
  -> /home/dsh-finance-workbench/plugins/dsh-openalice
```

改 workbench 里的代码即改即生效（DSH 刷新页面后加载）。

## 运行方式

- DSH:  `dsh web`（npm 全局，端口 3080）
- OpenAlice: `cd /home/OpenAlice/OpenAlice && pnpm dev`（Vite 5173）
- 访问: 浏览器隧道到 3080 + 5173
