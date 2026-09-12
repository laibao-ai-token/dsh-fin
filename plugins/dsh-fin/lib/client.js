/**
 * dsh-fin — 资产面板插件（浏览器端）
 *
 * 当前阶段：只注册右栏面板，不挂侧边栏入口。
 * 侧边栏按钮已移除（2026-09-12）—— 入口方式待定。
 */
window.__ModuleLoader__.load({
  id: "@local/dsh-fin",
  factory: (require) => {
    const React = require("react");

    // ── 右栏面板 ──────────────────────────────────────────
    function FinPanel() {
      return React.createElement("div", {
        style: {
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          padding: "20px",
          color: "var(--dsw-alias-label-tertiary, rgba(240,240,244,.55))",
          fontSize: "13px",
          textAlign: "center",
        },
      },
        React.createElement("div", {
          style: { fontSize: "24px", opacity: ".35", lineHeight: 1 },
        }, "◈"),
        React.createElement("div", null, "资产面板"),
        React.createElement("div", {
          style: { fontSize: "11.5px", opacity: ".7" },
        }, "面板已接入 · 待填数据"),
      );
    }

    // ── 挂载 ──────────────────────────────────────────────
    function apply(ctx) {
      console.log("[dsh-fin] apply() 开始");

      // 右栏面板（main keyed slot）
      try {
        ctx.slots.inject("main", () =>
          ctx.slots.register({
            name: "main",
            id: "finPanel",
          }, FinPanel));
        console.log("[dsh-fin] ✓ 右栏面板已注册");
      } catch (err) {
        console.error("[dsh-fin] ✗ 右栏面板注册失败:", err);
      }
    }

    return { apply, inject: ["slots"] };
  },
});
