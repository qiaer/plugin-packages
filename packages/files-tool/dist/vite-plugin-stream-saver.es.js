import { readFileSync as d, existsSync as u, mkdirSync as l, copyFileSync as f } from "fs";
import { resolve as i, dirname as n } from "path";
function S(p = {}) {
  const {
    swSrc: s = i(__dirname, "./sw.js"),
    mitmSrc: m = i(__dirname, "./mitm.html"),
    swDest: a = "sw.js",
    mitmDest: c = "mitm.html",
    outDir: o = "dist"
  } = p;
  return {
    name: "vite-plugin-stream-saver",
    configResolved(e) {
    },
    // 开发环境：提供中间件，直接返回 sw.js/mitm.html
    configureServer(e) {
      e.middlewares.use(async (t, r, v) => {
        if (t.url.indexOf(`/${a}`) !== -1) {
          r.setHeader("Content-Type", "application/javascript"), r.end(d(s));
          return;
        }
        if (t.url.indexOf(`/${c}`) !== -1) {
          r.setHeader("Content-Type", "text/html"), r.end(d(m));
          return;
        }
        v();
      });
    },
    // 构建时拷贝到 dist
    generateBundle() {
      const e = i(o, a);
      u(n(e)) || l(n(e), { recursive: !0 }), f(s, e);
      const t = i(o, c);
      u(n(t)) || l(n(t), { recursive: !0 }), f(m, t);
    }
  };
}
export {
  S as default
};
