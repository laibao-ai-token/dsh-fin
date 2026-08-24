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

    function apply(ctx) {
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
