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

    function RootPanel() {
      const { view: active, aliceLoaded } = useViewState();
      if (active === null && !aliceLoaded) return null;
      const title = active === "openalice" ? "OpenAlice 工作台" : "";
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
      ctx.slots.inject("details", () => ctx.slots.register({
        name: "details", id: "openalice", priority: -1,
      }, RootPanel));
    }

    return { apply, inject: ["slots"] };
  },
});
