# dsh-fin

DSH（DeepSeek Harness）的金融工作台插件。

## 定位

只通过插件机制扩展 DSH，**不改 DSH 本体源码**。

## 目录结构

    plugins/
      dsh-fin/           <- DSH 插件（包名 @local/dsh-fin）
        lib/index.js     <- 宿主端（Node）
        lib/client.js    <- 浏览器端（DSH 界面内）
        package.json     <- 插件清单（dsh.client 声明）
    config/              <- 配置文件
    docs/                <- 文档与架构图
    scripts/             <- 辅助脚本
    skills/              <- DSH 技能说明
    deploy/              <- 部署脚本
    vendor/              <- 第三方技能文档
    patches/             <- 补丁

## 当前状态

| 部分 | 状态 |
|---|---|
| dsh-fin 插件 | 空壳。仅注册一个占位面板，**尚无实际内容** |
| 前端界面 | 未设计 |
| 数据接入 | 未开始 |

## 外部依赖（不在本仓库）

| 项目 | 位置 | 用途 |
|---|---|---|
| DSH 运行目录 | /home/dsh-workspace | 编译后的 DSH 程序 |
| DSH 源码 | /home/deepseek-harness | 只读参考（插件 API / 槽位契约） |
| OpenAlice | /home/OpenAlice | 行情/财务/宏观等工具源，经 **MCP** 接入 |
| RSSHub | /home/rsshub | 新闻 RSS 源 |

> OpenAlice 通过 MCP 直连 DSH（mcp-openalice 行），不使用插件。

## 插件挂载方式

插件通过符号链接挂到 DSH profile：

    /root/.dsh/profiles/web/node_modules/@local/dsh-fin
      -> /home/dsh-fin/plugins/dsh-fin

DSH profile 配置目录：/root/.dsh/profiles/web/

- package.json      -- 声明 @local/dsh-fin 依赖
- cordis.patch.yml  -- 注册插件行 + MCP 连接

改本仓库代码即改即生效（DSH 刷新页面后加载）。

## 开发

    cd /home/dsh-fin
    git status
