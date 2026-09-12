window.__ModuleLoader__.load({
  id: "@local/dsh-fin",
  factory: (require) => {
    const React = require("react");

    // 模块级引用：apply 时赋值，组件点击时使用
    let ctxRef = null;

    // ────────────────────────────────────────────────
    // 右栏面板内容（第一步：占位）
    // ────────────────────────────────────────────────
    function FinPanel() {
      return React.createElement("div", {
        style: {
          height: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: "10px", padding: "20px",
          color: "var(--dsw-alias-label-dimmed, rgba(240,240,244,.45))",
          fontSize: "13px", textAlign: "center",
        },
      },
        React.createElement("div",
          { style: { fontSize: "26px", opacity: ".35", lineHeight: 1 } }, "◈"),
        React.createElement("div", null, "面板已接入"),
        React.createElement("div",
          { style: { fontSize: "11.5px", opacity: ".7" } }, "下一步再填数据"),
      );
    }

    // ────────────────────────────────────────────────
    // 侧边栏入口
    // ────────────────────────────────────────────────
    function FinSidebarEntry({ wide }) {
      const open = () => {
        try {
          const c = ctxRef;
          if (!c || !c.layout) {
            console.warn("[dsh-fin] ctx.layout 不可用");
            return;
          }
          if (typeof c.layout.openRightbar === "function") {
            c.layout.openRightbar(true, false);
          }
          if (typeof c.layout.selectPanel === "function") {
            c.layout.selectPanel("finPanel");
          }
        } catch (err) {
          console.error("[dsh-fin] 打开面板失败:", err);
        }
      };

      return React.createElement("button", {
        type: "button",
        title: "资产面板",
        "aria-label": "资产面板",
        onClick: open,
        style: {
          display: "flex", alignItems: "center",
          justifyContent: wide ? "flex-start" : "center",
          gap: wide ? "8px" : "0",
          width: wide ? "100%" : "36px",
          minHeight: "36px", padding: wide ? "0 10px" : "0",
          border: "none", borderRadius: "8px",
          background: "transparent",
          color: "var(--dsw-alias-label-secondary, rgba(240,240,244,.65))",
          cursor: "pointer", font: "inherit", fontSize: "13px",
          transition: "background 150ms",
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.background =
            "var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06))";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.background = "transparent";
        },
      },
        React.createElement("span", {
          "aria-hidden": true,
          style: { fontSize: "16px", lineHeight: 1, flex: "none" },
        }, "◈"),
        wide && React.createElement("span", {
          style: {
            overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        }, "资产面板"),
      );
    }

    // ────────────────────────────────────────────────
    // 挂载
    // ────────────────────────────────────────────────
    function apply(ctx) {
      ctxRef = ctx;

      // 1) 侧边栏底部入口
      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register({
          name: "sidebar.footer.action",
          id: "fin-asset-panel",
          order: 100,
        }, FinSidebarEntry));

      // 2) 右栏面板（main keyed slot）
      ctx.slots.inject("main", () =>
        ctx.slots.register({
          name: "main",
          id: "finPanel",
        }, FinPanel));
    }

    return { apply, inject: ["slots"] };
  },
});
