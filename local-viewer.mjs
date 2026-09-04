import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const __dirname = path.dirname(
  new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
const requireFromViewer = createRequire(path.join(__dirname, "package.json"));

const target = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!target || !fs.existsSync(target)) {
  console.error("対象 JSX / TSX ファイルが指定されていません。");
  process.exit(1);
}

const targetDir = path.dirname(target);
const targetName = path.basename(target);
const DEFAULT_PORT = 5180;
const configuredPort = Number(process.env.PORT);
const PORT_START =
  Number.isInteger(configuredPort) &&
  configuredPort >= 1 &&
  configuredPort <= 65535
    ? configuredPort
    : DEFAULT_PORT;

const SHADCN = {
  button: `import React from "react"; export const Button=React.forwardRef(function Button({className="",...props},ref){return <button ref={ref} className={"inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border bg-white "+className} {...props}/>});`,
  card: `import React from "react"; const mk=(tag,base)=>React.forwardRef(function C({className="",...props},ref){return React.createElement(tag,{ref,className:base+" "+className,...props})}); export const Card=mk("div","rounded-xl border bg-white shadow-sm"); export const CardHeader=mk("div","p-6"); export const CardTitle=mk("h3","font-semibold"); export const CardDescription=mk("p","text-sm text-slate-500"); export const CardContent=mk("div","p-6 pt-0"); export const CardFooter=mk("div","p-6 pt-0");`,
};

function stub(name) {
  return (
    SHADCN[name] ??
    `import React from "react"; export default function Generic({children,className="",...props}){return <div className={className} {...props}>{children}</div>}`
  );
}

const plugin = {
  name: "local-direct-resolver",
  setup(build) {
    build.onResolve({ filter: /^@\/components\/ui\// }, (args) => ({
      path: args.path.split("/").pop(),
      namespace: "shadcn",
    }));
    build.onLoad({ filter: /.*/, namespace: "shadcn" }, (args) => ({
      contents: stub(args.path),
      loader: "jsx",
    }));

    build.onResolve({ filter: /^@\/lib\/utils$/ }, () => ({
      path: "utils",
      namespace: "shadcn-lib",
    }));
    build.onLoad({ filter: /.*/, namespace: "shadcn-lib" }, () => ({
      contents: `export function cn(...xs){return xs.flatMap(x=>Array.isArray(x)?x:[x]).filter(Boolean).join(" ")}`,
      loader: "js",
    }));

    build.onResolve({ filter: /^@\// }, (args) => ({
      path: path.join(targetDir, args.path.slice(2)),
    }));

    build.onResolve({ filter: /^[^./][^:]*/ }, (args) => {
      try {
        return { path: requireFromViewer.resolve(args.path) };
      } catch {
        return null;
      }
    });
  },
};

async function buildBundle() {
  const wrapper = `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import * as TargetModule from ${JSON.stringify(target)};
    const Component = TargetModule.default ?? Object.values(TargetModule).find(v=>typeof v==="function");
    const root=document.getElementById("root");
    if(!Component){
      root.innerHTML='<div style="padding:24px;font-family:system-ui;color:#991b1b">表示可能な React コンポーネントが見つかりません</div>';
    } else {
      createRoot(root).render(React.createElement(Component));
    }
  `;
  const result = await esbuild.build({
    stdin: {
      contents: wrapper,
      resolveDir: targetDir,
      sourcefile: "__local_entry__.jsx",
      loader: "jsx",
    },
    bundle: true,
    write: false,
    outfile: "bundle.js",
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    jsx: "automatic",
    sourcemap: "inline",
    define: { "process.env.NODE_ENV": '"development"', global: "window" },
    loader: {
      ".js": "jsx",
      ".jsx": "jsx",
      ".ts": "ts",
      ".tsx": "tsx",
      ".css": "css",
      ".svg": "dataurl",
      ".png": "dataurl",
      ".jpg": "dataurl",
      ".jpeg": "dataurl",
      ".gif": "dataurl",
    },
    plugins: [plugin],
    logLevel: "silent",
  });
  const js = result.outputFiles.find((x) => /bundle\.js$/i.test(x.path))?.text;
  if (!js) throw new Error("JavaScript バンドルを取得できませんでした。");
  return js;
}

async function buildCss() {
  const input = `@tailwind base;@tailwind components;@tailwind utilities;html,body,#root{min-height:100%}body{margin:0}*{box-sizing:border-box}`;
  const source = fs.readFileSync(target, "utf8");
  const result = await postcss([
    tailwindcss({
      content: [
        { raw: source, extension: path.extname(target).slice(1) || "jsx" },
        { raw: Object.values(SHADCN).join("\n"), extension: "jsx" },
      ],
      theme: { extend: {} },
      plugins: [],
    }),
    autoprefixer,
  ]).process(input, { from: undefined });
  return result.css;
}

function page() {
  const n = targetName.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
  return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${n} - JSX Viewer</title><link rel="stylesheet" href="/style.css"><style>#bar{position:sticky;top:0;z-index:99999;display:flex;gap:8px;align-items:center;padding:7px 10px;background:#111827;color:#fff;font:13px system-ui}#bar .n{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#bar button{border:1px solid #4b5563;border-radius:7px;padding:6px 9px;background:#1f2937;color:white}#err{display:none;white-space:pre-wrap;margin:16px;padding:16px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;font:13px/1.5 Consolas,monospace}</style></head><body><div id="bar"><strong>Local JSX</strong><span class="n">${n}</span><button onclick="location.reload()">再読み込み</button></div><div id="err"></div><div id="root"></div><script>function showError(p,v){const b=document.getElementById("err");b.style.display="block";b.textContent=p+"\\n"+(v?.stack||v?.message||String(v))}window.addEventListener("error",e=>showError("実行時エラー:",e.error||e.message));window.addEventListener("unhandledrejection",e=>showError("Promise エラー:",e.reason));</script><script src="/bundle.js"></script></body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/bundle.js") {
      const js = await buildBundle();
      res.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      });
      return res.end(js);
    }
    if (req.url === "/style.css") {
      const css = await buildCss();
      res.writeHead(200, {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "no-store",
      });
      return res.end(css);
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(page());
  } catch (err) {
    const details =
      err?.errors
        ?.map(
          (e) =>
            e.text +
            (e.location
              ? `\n  ${e.location.file}:${e.location.line}:${e.location.column}`
              : ""),
        )
        .join("\n\n") ||
      err?.stack ||
      String(err);
    if (req.url === "/bundle.js") {
      res.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf-8",
      });
      return res.end(`showError("ビルドエラー:",${JSON.stringify(details)});`);
    }
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(details);
  }
});

function openBrowser(url) {
  spawn("cmd", ["/c", "start", "", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}
function listen(port) {
  return new Promise((resolve, reject) => {
    const tryPort = (p) => {
      const onErr = (e) => {
        server.off("listening", onListen);
        if (e.code === "EADDRINUSE") tryPort(p + 1);
        else reject(e);
      };
      const onListen = () => {
        server.off("error", onErr);
        resolve(p);
      };
      server.once("error", onErr);
      server.once("listening", onListen);
      server.listen(p, "127.0.0.1");
    };
    tryPort(PORT_START);
  });
}
const port = await listen(PORT_START);
const url = `http://127.0.0.1:${port}/`;
console.log("Local JSX Viewer:", target);
console.log("URL:", url);
openBrowser(url);
