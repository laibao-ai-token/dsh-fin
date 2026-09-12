export const inject = [];

export function apply() {
  // dsh-fin 目前是纯浏览器端插件（侧边栏入口 + 右栏面板）。
  // 这个 host 半边存在，是为了让 DSH 的 client roster 能发现并加载浏览器模块。
  // 后续要注册模型可见的工具（行情、资讯等）时，在这里通过 ctx.tools.register 添加。
}
