window.__ModuleLoader__.load({
  id: "@local/dsh-openalice",
  factory: (require) => {
    const React = require("react");

    // ── 纯 DOM overlay（不依赖 react-dom）─────────────────────────
    let overlayEl = null;

    function closeOverlay() {
      // 只隐藏不销毁 —— iframe 保持加载状态，下次打开秒显
      if (overlayEl) { overlayEl.style.display = "none"; }
    }

    function openOverlay() {
      if (overlayEl) { overlayEl.style.display = "flex"; return; }
      const root = document.createElement("div");
      root.style.cssText = "position:fixed;inset:0;z-index:999999;display:flex;flex-direction:column;background:#111118;";

      // 顶栏
      const bar = document.createElement("div");
      bar.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 12px;flex:0 0 auto;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(20,20,28,.95);";
      const backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.textContent = "← 返回 DSH";
      backBtn.style.cssText = "display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:5px 12px;background:transparent;color:#f0f0f4;cursor:pointer;font:inherit;font-size:13px;";
      backBtn.addEventListener("click", closeOverlay);
      const title = document.createElement("span");
      title.textContent = "OpenAlice 工作台";
      title.style.cssText = "font-size:13px;color:rgba(240,240,244,.6);";
      bar.appendChild(backBtn);
      bar.appendChild(title);

      // iframe
      const iframe = document.createElement("iframe");
      iframe.title = "OpenAlice";
      iframe.src = "http://localhost:5173/";
      iframe.style.cssText = "width:100%;flex:1 1 0;min-height:0;border:0;background:#fff;";
      iframe.allow = "clipboard-read; clipboard-write";

      root.appendChild(bar);
      root.appendChild(iframe);
      document.body.appendChild(root);
      overlayEl = root;
    }

    // iframe 预加载：页面加载后就建好 overlay 并隐藏，点开秒显
    function preloadOverlay() {
      if (overlayEl) return;
      openOverlay();
      overlayEl.style.display = "none";
    }

    function toggleOverlay() {
      if (overlayEl && overlayEl.style.display !== "none") closeOverlay();
      else openOverlay();
    }

    // ── Sidebar entry ────────────────────────────────────────────────
    function OpenAliceSidebarEntry({ wide }) {
      return React.createElement("button", {
        type: "button",
        title: "OpenAlice 工作台",
        "aria-label": "OpenAlice 工作台",
        onClick: toggleOverlay,
        style: {
          display: "flex", alignItems: "center",
          justifyContent: wide ? "flex-start" : "center",
          gap: wide ? "8px" : "0", width: wide ? "100%" : "36px",
          minHeight: "36px", padding: wide ? "0 10px" : "0",
          border: "none", borderRadius: "8px",
          background: "transparent",
          color: "var(--dsw-alias-label-secondary, rgba(240,240,244,.65))",
          cursor: "pointer", font: "inherit", fontSize: "13px", transition: "background 150ms",
        },
        onMouseEnter: (e) => { e.currentTarget.style.background = "var(--dsw-alias-fill-hover, rgba(255,255,255,.07))"; },
        onMouseLeave: (e) => { e.currentTarget.style.background = "transparent"; },
      },
        React.createElement("span", { "aria-hidden": true, style: { fontSize: "16px", lineHeight: 1, flex: "none" } }, "◈"),
        wide && React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "OpenAlice"),
      );
    }

    // ── Mobile CSS ─────────────────────────────────────────────────
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

    // ── Lightbox ───────────────────────────────────────────────────
    function injectLightbox() {
      if (document.getElementById("dsh-lightbox-css")) return;
      const css = [
        ".dsh-lightbox-overlay {",
        "  position: fixed; inset: 0; z-index: 9999999;",
        "  background: rgba(0,0,0,.85);",
        "  display: flex; align-items: center; justify-content: center;",
        "  cursor: zoom-out; padding: 16px;",
        "}",
        ".dsh-lightbox-overlay img {",
        "  max-width: 95vw; max-height: 95vh;",
        "  object-fit: contain; border-radius: 8px;",
        "}",
        ".dsw-chat img, [class*=message] img, [class*=markdown] img { cursor: zoom-in; }",
      ].join("\n");
      const style = document.createElement("style");
      style.id = "dsh-lightbox-css";
      style.textContent = css;
      document.head.appendChild(style);
      document.addEventListener("click", (e) => {
        const img = e.target;
        if (img.tagName !== "IMG") return;
        if (img.naturalWidth < 80 && img.naturalHeight < 80) return;
        e.preventDefault();
        e.stopPropagation();
        const overlay = document.createElement("div");
        overlay.className = "dsh-lightbox-overlay";
        const big = document.createElement("img");
        big.src = img.src;
        big.alt = img.alt || "";
        overlay.appendChild(big);
        overlay.addEventListener("click", () => overlay.remove());
        document.body.appendChild(overlay);
      });
    }

    function apply(ctx) {
      injectMobileCSS();
      injectLightbox();
      // 页面加载后延迟预建 OpenAlice iframe（隐藏状态），首次点开秒显
      setTimeout(preloadOverlay, 1500);
      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
        name: "sidebar.footer.action", id: "openalice", order: 100,
      }, OpenAliceSidebarEntry));
    }

    return { apply, inject: ["slots"] };
  },
});
