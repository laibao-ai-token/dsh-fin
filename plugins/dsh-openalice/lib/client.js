window.__ModuleLoader__.load({
  id: "@local/dsh-openalice",
  factory: (require) => {
    const React = require("react");

    let open = false;
    let loadedOnce = false; // iframe 只加载一次，之后只切换显示
    const listeners = new Set();
    const subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const notify = () => { for (const listener of listeners) listener(); };
    const setOpen = (value) => {
      open = value;
      if (value) loadedOnce = true; // 第一次打开时才真正挂 iframe
      notify();
    };

    function useOpenState() {
      const [, redraw] = React.useState(0);
      React.useEffect(() => subscribe(() => redraw((v) => v + 1)), []);
      return { open, loadedOnce };
    }

    // ── Sidebar entry ────────────────────────────────────────────────
    function OpenAliceSidebarEntry({ wide }) {
      const { open: active } = useOpenState();
      return React.createElement("button", {
        type: "button",
        title: "OpenAlice 工作台",
        "aria-label": "OpenAlice 工作台",
        "aria-pressed": active,
        onClick: () => setOpen(!active),
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: wide ? "flex-start" : "center",
          gap: wide ? "8px" : "0",
          width: wide ? "100%" : "36px",
          minHeight: "36px",
          padding: wide ? "0 10px" : "0",
          border: "none",
          borderRadius: "8px",
          background: active
            ? "var(--dsw-alias-fill-active, rgba(255,255,255,.12))"
            : "transparent",
          color: active
            ? "var(--dsw-alias-label-primary, #f0f0f4)"
            : "var(--dsw-alias-label-secondary, rgba(240,240,244,.65))",
          cursor: "pointer",
          font: "inherit",
          fontSize: "13px",
          transition: "background 150ms",
        },
        onMouseEnter: (e) => {
          if (!active) e.currentTarget.style.background = "var(--dsw-alias-fill-hover, rgba(255,255,255,.07))";
        },
        onMouseLeave: (e) => {
          if (!active) e.currentTarget.style.background = "transparent";
        },
      },
        React.createElement("span", {
          "aria-hidden": true,
          style: { fontSize: "16px", lineHeight: 1, flex: "none" },
        }, "\u25C8"),
        wide && React.createElement("span", {
          style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        }, "OpenAlice"),
      );
    }

    // ── Details panel ────────────────────────────────────────────────
    // iframe 常驻：第一次打开才创建，之后用 display 切换，避免每次重载 Vite。
    function OpenAlicePanel() {
      const { open: active, loadedOnce: shouldMount } = useOpenState();

      // 从未打开过：不渲染任何东西，details 槽位交给 DSH 默认面板。
      // 注意：priority -1 让我们成为 details 的占座者，所以返回 null 时
      // 详情栏会是空的 —— 这正是"未打开时不占位"的期望。
      if (!shouldMount) return null;

      return React.createElement("div", {
        style: {
          position: "absolute",
          inset: "0",
          zIndex: 10,
          // 关闭时不销毁，只隐藏 —— 下次打开秒开，不重新加载
          display: active ? "flex" : "none",
          flexDirection: "column",
          background: "var(--dsw-alias-bg-base, #111118)",
          pointerEvents: active ? "auto" : "none",
        },
      },
        // 顶部返回条
        React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 10px",
            flex: "none",
            borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.1))",
            background: "var(--dsw-alias-bg-elevated, rgba(20,20,28,.9))",
          },
        },
          React.createElement("button", {
            type: "button",
            onClick: () => setOpen(false),
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              border: "1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.2))",
              borderRadius: "6px",
              padding: "4px 10px",
              background: "transparent",
              color: "var(--dsw-alias-label-primary, #f0f0f4)",
              cursor: "pointer",
              font: "inherit",
              fontSize: "12px",
            },
          }, "\u2190 返回 DSH"),
          React.createElement("span", {
            style: {
              fontSize: "12px",
              color: "var(--dsw-alias-label-secondary, rgba(240,240,244,.6))",
            },
          }, "OpenAlice 工作台"),
        ),
        React.createElement("iframe", {
          title: "OpenAlice",
          src: "http://localhost:25173/",
          style: { width: "100%", height: "100%", border: "0", flex: "1" },
          allow: "clipboard-read; clipboard-write",
        }),
      );
    }

    // ── 移动端适配 CSS ─────────────────────────────────────────────
    // DSH 未做响应式（无断点、固定 px 字号）。这里用 @media 在小屏上
    // 整体缩放 + 布局微调，让手机端可读可用。仅 max-width:768px 生效，
    // 桌面端完全不受影响。
    const MOBILE_CSS = `
@media (max-width: 768px) {
  /* 1. 整体缩放到 82% —— 比逐个改 font-size 干净，一劳永逸 */
  body {
    zoom: 0.82;
    /* 阻止 iOS Safari 的文本自动放大（字变大的元凶） */
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  /* 2. 输入框获得焦点时 iOS 会自动放大页面，把输入框字号提到 16px 避免触发 */
  input, textarea, select, [contenteditable] {
    font-size: 16px !important;
  }

  /* 3. 侧边栏在手机端默认应该收起（避免挤占屏幕） */
  /* 注：具体 class 由 DSH 运行时生成，这里用通配兜底 */
}

/* 触屏设备：把过小的点击目标放大到至少 32px（可达性） */
@media (max-width: 768px) and (pointer: coarse) {
  button, [role="button"], a {
    min-height: 32px;
    min-width: 32px;
  }
}
`;

    function injectMobileCSS() {
      if (document.getElementById("dsh-mobile-css")) return;
      const style = document.createElement("style");
      style.id = "dsh-mobile-css";
      style.textContent = MOBILE_CSS;
      document.head.appendChild(style);
    }

    function apply(ctx) {
      // 注入移动端适配样式（幂等，只插一次）
      injectMobileCSS();

      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action",
        id: "openalice",
        order: 100,
      }, OpenAliceSidebarEntry));

      ctx.slots.inject("details", () => ctx.slots.register({
        name: "details",
        id: "openalice",
        priority: -1,
      }, OpenAlicePanel));
    }

    return { apply, inject: ["slots"] };
  },
});
