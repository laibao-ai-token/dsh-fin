window.__ModuleLoader__.load({
  id: "@local/dsh-openalice",
  factory: (require) => {
    const React = require("react");

    let view = null;
    let aliceLoadedOnce = false;
    const listeners = new Set();
    const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
    const notify = () => { for (const l of listeners) l(); };
    const setView = (v) => {
      view = (view === v) ? null : v;
      if (v === "openalice") aliceLoadedOnce = true;
      notify();
    };

    function useViewState() {
      const [, redraw] = React.useState(0);
      React.useEffect(() => subscribe(() => redraw((x) => x + 1)), []);
      return { view, aliceLoaded: aliceLoadedOnce };
    }

    function makeSidebarButton({ icon, label, viewName }) {
      return function SidebarButton({ wide }) {
        const { view: active } = useViewState();
        const activeNow = active === viewName;
        return React.createElement("button", {
          type: "button", title: label, "aria-label": label, "aria-pressed": activeNow,
          onClick: () => setView(viewName),
          style: {
            display: "flex", alignItems: "center",
            justifyContent: wide ? "flex-start" : "center",
            gap: wide ? "8px" : "0", width: wide ? "100%" : "36px",
            minHeight: "36px", padding: wide ? "0 10px" : "0",
            border: "none", borderRadius: "8px",
            background: activeNow ? "var(--dsw-alias-fill-active, rgba(255,255,255,.12))" : "transparent",
            color: activeNow ? "var(--dsw-alias-label-primary, #f0f0f4)" : "var(--dsw-alias-label-secondary, rgba(240,240,244,.65))",
            cursor: "pointer", font: "inherit", fontSize: "13px", transition: "background 150ms",
          },
          onMouseEnter: (e) => { if (!activeNow) e.currentTarget.style.background = "var(--dsw-alias-fill-hover, rgba(255,255,255,.07))"; },
          onMouseLeave: (e) => { if (!activeNow) e.currentTarget.style.background = "transparent"; },
        },
          React.createElement("span", { "aria-hidden": true, style: { fontSize: "16px", lineHeight: 1, flex: "none" } }, icon),
          wide && React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
        );
      };
    }

    const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    const OVERVIEW_MMD = "flowchart TB\n    subgraph USER[\"用户访问层\"]\n        DEVICE[\"手机 / 电脑浏览器\"]\n    end\n    subgraph DSH[\"DSH · AI 大脑（宿主）\"]\n        CORE[\"DSH Web 运行时 :3080\"]\n        P1[\"dsh-openalice 插件 已上线\"]\n        P2[\"dsh-fincept 插件 规划中\"]\n    end\n    subgraph OPENALICE[\"OpenAlice · 交易工作台\"]\n        GUARD[\"Guardian 进程总管\"]\n        ALICE[\"Alice 主进程 5173/47331/47332\"]\n        UTA[\"UTA 交易权威（lite 未启用）\"]\n        CLIS[\"原生 Agent CLI\"]\n    end\n    subgraph FINCEPT[\"Fincept · 金融数据后端\"]\n        MCP[\"83 个 MCP 数据工具\"]\n    end\n    MODEL[\"外部模型 grok-4.5\"]\n    DEVICE -->|隧道/直连| CORE\n    CORE --> P1\n    CORE --> P2\n    P1 -->|iframe 嵌入| ALICE\n    GUARD --> ALICE\n    GUARD --> UTA\n    ALICE -->|拉起进程| CLIS\n    CLIS -->|注入凭证| MODEL\n    P2 -.->|规划中| MCP\n    MCP -.->|供数| ALICE\n    style USER fill:#e3f2fd,stroke:#1976D2,color:#000\n    style DSH fill:#fff3e0,stroke:#F57C00,color:#000\n    style OPENALICE fill:#f3e5f5,stroke:#7B1FA2,color:#000\n    style FINCEPT fill:#e8f5e9,stroke:#388E3C,color:#000\n    style MODEL fill:#fce4ec,stroke:#C2185B,color:#000";
    const DATAFLOW_MMD = "sequenceDiagram\n    participant U as 用户\n    participant D as DSH 3080\n    participant A as OpenAlice\n    participant C as claude CLI\n    participant M as 模型服务\n    U->>D: 打开 DSH，点 OpenAlice\n    D->>A: 插件加载 iframe 5173\n    A-->>U: 显示交易工作台界面\n    U->>A: 在 Chat 提问\n    A->>C: 拉起 claude CLI 注入凭证\n    C->>M: 调用模型\n    M-->>C: 返回回答\n    C-->>A: 结果写回工作区或 Inbox\n    A-->>U: 显示对话或报告";

    function loadMermaid(cb) {
      if (window.mermaid) { cb(null); return; }
      if (window.__dshMermaidQueue) { window.__dshMermaidQueue.push(cb); return; }
      window.__dshMermaidQueue = [cb];
      const flush = (err) => { const q = window.__dshMermaidQueue; window.__dshMermaidQueue = null; (q || []).forEach((f) => f(err)); };
      const s = document.createElement("script");
      s.src = MERMAID_CDN;
      s.onload = () => { try { window.mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" }); } catch (_) {} flush(null); };
      s.onerror = () => flush(new Error("mermaid load failed"));
      document.head.appendChild(s);
    }

    function MermaidDiagram({ code, id }) {
      const [html, setHtml] = React.useState(null);
      const [error, setError] = React.useState(null);
      React.useEffect(() => {
        let cancelled = false;
        loadMermaid((err) => {
          if (cancelled) return;
          if (err) { setError("Mermaid 加载失败，显示源码"); return; }
          window.mermaid.render("dsharch-" + id, code)
            .then((r) => { if (!cancelled) setHtml(r.svg); })
            .catch((e) => { if (!cancelled) setError(String((e && e.message) || e)); });
        });
        return () => { cancelled = true; };
      }, [code, id]);
      if (error) return React.createElement("pre", { style: { margin: 0, padding: "12px", fontSize: "12px", color: "#c9d1d9", whiteSpace: "pre-wrap" } }, code);
      if (!html) return React.createElement("div", { style: { padding: "24px", textAlign: "center", color: "#8b90a0", fontSize: "13px" } }, "渲染中…");
      return React.createElement("div", {
        style: { background: "#ffffff", borderRadius: "8px", padding: "12px", overflowX: "auto", display: "flex", justifyContent: "center" },
        dangerouslySetInnerHTML: { __html: html },
      });
    }

    const PORT_TABLE = {
      headers: ["组件", "端口", "绑定", "状态"],
      rows: [
        ["🧠 DSH Web", "3080", "本机", "✅ 运行"],
        ["📊 OpenAlice 前端（Vite）", "5173", "仅 127.0.0.1", "✅ 运行"],
        ["📊 OpenAlice 后端 API", "47331", "仅 127.0.0.1", "✅ 运行"],
        ["📊 OpenAlice 工具网关", "47332", "仅 127.0.0.1", "✅ 运行"],
        ["📊 UTA 交易", "—", "—", "⏸️ lite 未启用"],
      ],
    };
    const ROLE_TABLE = {
      headers: ["组件", "角色", "负责"],
      rows: [
        ["DSH", "大脑 + 宿主", "想（Agent 推理、任务编排）"],
        ["OpenAlice", "工作台界面", "摆（工作区 / 任务 / 审批 / 报告）"],
        ["Fincept", "数据后端", "喂（行情 / 基本面 / 宏观）"],
      ],
    };
    const PROGRESS_TABLE = {
      headers: ["项", "状态"],
      rows: [
        ["DSH + OpenAlice 运行（已安全加固）", "✅"],
        ["dsh-openalice 插件（嵌入）", "✅"],
        ["OpenAlice Chat（claude + grok-4.5）", "✅ 底层已通"],
        ["dsh-fincept 数据桥接", "⏳ 下一步重点"],
        ["UTA 真交易（接券商）", "⏳ 未启用"],
        ["架构方向定稿（DSH 为主）", "⏳ 待确认"],
      ],
    };

    function Table({ headers, rows }) {
      return React.createElement("table", { style: { borderCollapse: "collapse", width: "100%", fontSize: "13px" } },
        React.createElement("thead", null,
          React.createElement("tr", null,
            headers.map((h, i) => React.createElement("th", {
              key: i,
              style: { border: "1px solid rgba(255,255,255,.12)", padding: "6px 10px", textAlign: "left", background: "rgba(255,255,255,.05)", color: "#90caf9", fontWeight: 600 },
            }, h)),
          ),
        ),
        React.createElement("tbody", null,
          rows.map((r, ri) => React.createElement("tr", { key: ri },
            r.map((c, ci) => React.createElement("td", {
              key: ci,
              style: { border: "1px solid rgba(255,255,255,.1)", padding: "6px 10px", color: "#e6e6e6" },
            }, c)),
          )),
        ),
      );
    }

    function Section({ title, children }) {
      return React.createElement("section", {
        style: { background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: "12px", padding: "16px", marginBottom: "16px" },
      },
        React.createElement("h3", { style: { margin: "0 0 12px", fontSize: "15px", color: "#ffb74d" } }, title),
        children,
      );
    }

    function ArchPanel() {
      return React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "16px", background: "var(--dsw-alias-bg-base, #111118)" } },
        React.createElement("div", { style: { maxWidth: "900px", margin: "0 auto" } },
          React.createElement("h2", { style: { margin: "0 0 4px", fontSize: "18px", color: "#f0f0f4" } }, "🏗️ 三合一资产管理工作台 · 架构图"),
          React.createElement("p", { style: { margin: "0 0 16px", fontSize: "13px", color: "#9aa0b0" } }, "DSH = AI 大脑 · OpenAlice = 交易工作台界面 · Fincept = 金融数据后端"),
          React.createElement(Section, { title: "一、整体分层" }, React.createElement(MermaidDiagram, { id: "overview", code: OVERVIEW_MMD })),
          React.createElement(Section, { title: "二、关键数据流" }, React.createElement(MermaidDiagram, { id: "dataflow", code: DATAFLOW_MMD })),
          React.createElement(Section, { title: "三、端口与进程清单" }, React.createElement(Table, PORT_TABLE)),
          React.createElement(Section, { title: "四、角色分工" }, React.createElement(Table, ROLE_TABLE)),
          React.createElement(Section, { title: "五、进度快照" }, React.createElement(Table, PROGRESS_TABLE)),
        ),
      );
    }

    function RootPanel() {
      const { view: active, aliceLoaded } = useViewState();
      if (active === null && !aliceLoaded) return null;
      const title = active === "openalice" ? "OpenAlice 工作台" : (active === "arch" ? "架构图" : "");
      return React.createElement("div", {
        style: {
          position: "absolute", inset: "0", zIndex: 10,
          display: active !== null ? "flex" : "none",
          flexDirection: "column",
          background: "var(--dsw-alias-bg-base, #111118)",
          pointerEvents: active !== null ? "auto" : "none",
        },
      },
        React.createElement("div", {
          style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", flex: "none", borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.1))", background: "var(--dsw-alias-bg-elevated, rgba(20,20,28,.9))" },
        },
          React.createElement("button", {
            type: "button",
            onClick: () => setView(active),
            style: { display: "inline-flex", alignItems: "center", gap: "6px", border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.2))", borderRadius: "6px", padding: "4px 10px", background: "transparent", color: "var(--dsw-alias-label-primary, #f0f0f4)", cursor: "pointer", font: "inherit", fontSize: "12px" },
          }, "\u2190 返回 DSH"),
          React.createElement("span", { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary, rgba(240,240,244,.6))" } }, title),
        ),
        aliceLoaded ? React.createElement("iframe", {
          title: "OpenAlice",
          src: "http://localhost:5173/",
          style: { width: "100%", height: "100%", border: "0", flex: "1", display: active === "openalice" ? "block" : "none" },
          allow: "clipboard-read; clipboard-write",
        }) : null,
        active === "arch" ? React.createElement(ArchPanel) : null,
      );
    }

    const MOBILE_CSS = [
      "@media (max-width: 768px) {",
      "  body { zoom: 0.82; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }",
      "  input, textarea, select, [contenteditable] { font-size: 16px !important; }",
      "}",
      "@media (max-width: 768px) and (pointer: coarse) {",
      "  button, [role=button], a { min-height: 32px; min-width: 32px; }",
      "}",
    ].join("\n");

    function injectMobileCSS() {
      if (document.getElementById("dsh-mobile-css")) return;
      const style = document.createElement("style");
      style.id = "dsh-mobile-css";
      style.textContent = MOBILE_CSS;
      document.head.appendChild(style);
    }

    function apply(ctx) {
      injectMobileCSS();
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action", id: "openalice", order: 100,
      }, makeSidebarButton({ icon: "\u25C8", label: "OpenAlice", viewName: "openalice" })));
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action", id: "openalice-arch", order: 101,
      }, makeSidebarButton({ icon: "\u25E7", label: "架构图", viewName: "arch" })));
      ctx.slots.inject("details", () => ctx.slots.register({
        name: "details", id: "openalice", priority: -1,
      }, RootPanel));
    }

    return { apply, inject: ["slots"] };
  },
});
