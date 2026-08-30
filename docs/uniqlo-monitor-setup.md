# 优衣库价格监控 — 电脑端部署指南

> 目标：在你电脑上拿到优衣库（天猫/淘宝旗舰店）的实时价格数据。

## 一次性安装（5分钟）

### 1. 装 OpenCLI

```bash
npm install -g @jackwener/opencli
```

要求 Node.js >= 20.18.1（`node --version` 检查）。

### 2. 装 Chrome 插件（浏览器桥）

方式A（推荐）：Chrome 应用商店搜 "OpenCLI" 安装。
方式B：从 https://github.com/jackwener/OpenCLI/releases 下载
opencli-extension-v*.zip，解压后 chrome://extensions → 开发者模式 →
加载已解压的扩展程序。

### 3. 验证桥接

```bash
opencli doctor
```

看到 Extension: connected 即成功。

### 4. 登录淘宝

```bash
opencli taobao login
```

会打开 Chrome 的淘宝登录页，你手动登录（扫码/账密）。
完成后验证：

```bash
opencli taobao whoami
```

## 采集脚本

把 deploy/uniqlo_monitor.sh 拷到电脑上：

```bash
# 首次采集（建立价格基线）
./uniqlo_monitor.sh 优衣库 30

# 之后每次运行，自动对比历史，输出降价项
./uniqlo_monitor.sh 优衣库 30
```

数据存在 ~/.uniqlo-monitor/：
- latest.json    最新一次快照
- history.jsonl  全部历史（每行一条）

## 定时运行（可选）

crontab -e 加一行（每2小时跑一次）：

```
0 */2 * * * /path/to/uniqlo_monitor.sh 优衣库 30 >> ~/.uniqlo-monitor/run.log 2>&1
```

## 下一步（服务器端，我来做）

电脑端拿到数据后，怎么让服务器"看到"并触发飞书推送：
方案A: 脚本里降价时直接 curl 飞书 webhook（最简单，推荐）
方案B: 数据回传服务器，由服务器的监控逻辑统一处理
