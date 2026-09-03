
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const requireFromViewer = createRequire(path.join(__dirname, "package.json"));

const target = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!target || !fs.existsSync(target)) {
  console.error("対象 JSX/TSX ファイルが指定されていません。");
  process.exit(1);
}

const targetDir = path.dirname(target);
const targetName = path.basename(target);
const PORT_START = 5177;

const SHADCN_COMPONENTS = {
  button: `
    import React from "react";
    export const Button = React.forwardRef(function Button({className="", variant="default", size="default", asChild=false, ...props}, ref) {
      const C = asChild ? React.Fragment : "button";
      if (asChild) return <C {...props} />;
      return <button ref={ref} className={"inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors border bg-white hover:bg-slate-50 disabled:opacity-50 " + className} {...props} />;
    });
  `,
  card: `
    import React from "react";
    const mk=(tag,base)=>React.forwardRef(function C({className="",...props},ref){return React.createElement(tag,{ref,className:base+" "+className,...props})});
    export const Card=mk("div","rounded-xl border bg-white text-slate-950 shadow-sm");
    export const CardHeader=mk("div","flex flex-col space-y-1.5 p-6");
    export const CardTitle=mk("h3","font-semibold leading-none tracking-tight");
    export const CardDescription=mk("p","text-sm text-slate-500");
    export const CardContent=mk("div","p-6 pt-0");
    export const CardFooter=mk("div","flex items-center p-6 pt-0");
  `,
  input: `
    import React from "react";
    export const Input=React.forwardRef(function Input({className="",...props},ref){return <input ref={ref} className={"flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 "+className} {...props}/>});
  `,
  textarea: `
    import React from "react";
    export const Textarea=React.forwardRef(function Textarea({className="",...props},ref){return <textarea ref={ref} className={"flex min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 "+className} {...props}/>});
  `,
  label: `
    import React from "react";
    export const Label=React.forwardRef(function Label({className="",...props},ref){return <label ref={ref} className={"text-sm font-medium leading-none "+className} {...props}/>});
  `,
  badge: `
    import React from "react";
    export function Badge({className="",...props}){return <div className={"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold "+className} {...props}/>}
  `,
  separator: `
    import React from "react";
    export function Separator({className="",orientation="horizontal",...props}){return <div className={(orientation==="vertical"?"h-full w-px":"h-px w-full")+" bg-slate-200 "+className} {...props}/>}
  `,
  tabs: `
    import React,{createContext,useContext,useState} from "react";
    const C=createContext(null);
    export function Tabs({defaultValue,value,onValueChange,className="",children,...props}){const [v,setV]=useState(defaultValue);const actual=value??v;const set=x=>{setV(x);onValueChange?.(x)};return <C.Provider value={{v:actual,set}}><div className={className} {...props}>{children}</div></C.Provider>}
    export function TabsList({className="",...props}){return <div className={"inline-flex h-10 items-center rounded-md bg-slate-100 p-1 "+className} {...props}/>}
    export function TabsTrigger({value,className="",...props}){const c=useContext(C);return <button onClick={()=>c.set(value)} className={"inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm "+(c.v===value?"bg-white shadow-sm":"")+" "+className} {...props}/>}
    export function TabsContent({value,className="",...props}){const c=useContext(C);return c.v===value?<div className={"mt-2 "+className} {...props}/>:null}
  `,
  alert: `
    import React from "react";
    export function Alert({className="",...props}){return <div role="alert" className={"relative w-full rounded-lg border p-4 "+className} {...props}/>}
    export function AlertTitle({className="",...props}){return <h5 className={"mb-1 font-medium leading-none "+className} {...props}/>}
    export function AlertDescription({className="",...props}){return <div className={"text-sm "+className} {...props}/>}
  `,
  switch: `
    import React from "react";
    export function Switch({checked,onCheckedChange,className="",...props}){return <button role="switch" aria-checked={checked} onClick={()=>onCheckedChange?.(!checked)} className={"relative inline-flex h-6 w-11 items-center rounded-full transition "+(checked?"bg-slate-900":"bg-slate-300")+" "+className} {...props}><span className={"inline-block h-5 w-5 transform rounded-full bg-white transition "+(checked?"translate-x-5":"translate-x-0.5")}/></button>}
  `
};

function shadcnStub(name) {
  return SHADCN_COMPONENTS[name] ?? `
    import React from "react";
    const Generic = ({children, className="", ...props}) => <div className={className} {...props}>{children}</div>;
    export default Generic;
  `;
}

const viewerPlugin = {
  name: "viewer-resolver",
  setup(build) {
    build.onResolve({ filter: /^@\/components\/ui\// }, args => {
      const name = args.path.split("/").pop();
      return { path: name, namespace: "shadcn-ui" };
    });

    build.onLoad({ filter: /.*/, namespace: "shadcn-ui" }, args => ({
      contents: shadcnStub(args.path),
      loader: "jsx"
    }));

    build.onResolve({ filter: /^@\/lib\/utils$/ }, () => ({
      path: "utils",
      namespace: "shadcn-lib"
    }));

    build.onLoad({ filter: /.*/, namespace: "shadcn-lib" }, () => ({
      contents: `
        export function cn(...xs) {
          return xs.flatMap(x => Array.isArray(x) ? x : [x]).filter(Boolean).join(" ");
        }
      `,
      loader: "js"
    }));

    build.onResolve({ filter: /^@\// }, args => {
      const relative = args.path.slice(2);
      const candidate = path.join(targetDir, relative);
      return { path: candidate };
    });

    build.onResolve({ filter: /^[^./][^:]*/ }, args => {
      try {
        return { path: requireFromViewer.resolve(args.path) };
      } catch {
        return null;
      }
    });
  }
};

async function buildBundle() {
  const wrapper = `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import * as TargetModule from ${JSON.stringify(target)};

    const Component =
      TargetModule.default ??
      Object.values(TargetModule).find(v => typeof v === "function");

    const rootEl = document.getElementById("root");

    if (!Component) {
      rootEl.innerHTML =
        '<div style="padding:24px;font-family:system-ui;color:#991b1b">' +
        '<h2>表示可能な React コンポーネントが見つかりません</h2>' +
        '<p>default export または関数コンポーネントを含む JSX/TSX を指定してください。</p>' +
        '</div>';
    } else {
      createRoot(rootEl).render(React.createElement(Component));
    }
  `;

  const result = await esbuild.build({
    stdin: {
      contents: wrapper,
      resolveDir: targetDir,
      sourcefile: "__jsx_viewer_entry__.jsx",
      loader: "jsx"
    },
    bundle: true,
    write: false,
    outfile: "bundle.js",
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    jsx: "automatic",
    sourcemap: "inline",
    define: {
      "process.env.NODE_ENV": '"development"',
      "global": "window"
    },
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
      ".gif": "dataurl"
    },
    plugins: [viewerPlugin],
    logLevel: "silent"
  });

  const jsFile =
    result.outputFiles.find(x => /bundle\.js$/i.test(x.path)) ??
    result.outputFiles.find(x => x.path.endsWith(".js"));

  if (!jsFile || !jsFile.text.trim()) {
    throw new Error(
      "esbuild は完了しましたが JavaScript バンドルを取得できませんでした。\n" +
      "outputFiles: " + result.outputFiles.map(x => x.path).join(", ")
    );
  }

  return jsFile.text;
}

function collectTailwindSources(rootDir) {
  const allowed = new Set([".js", ".jsx", ".ts", ".tsx", ".html"]);
  const ignoredDirs = new Set([
    "node_modules", ".git", ".svn", ".hg",
    "dist", "build", "coverage", ".next", ".vite"
  ]);
  const maxFiles = 300;
  const maxFileBytes = 1024 * 1024;
  const sources = [];

  function walk(dir, depth = 0) {
    if (depth > 8 || sources.length >= maxFiles) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (sources.length >= maxFiles) break;

      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) walk(full, depth + 1);
        continue;
      }

      if (!entry.isFile() || !allowed.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }

      try {
        const stat = fs.statSync(full);
        if (stat.size > maxFileBytes) continue;

        sources.push({
          raw: fs.readFileSync(full, "utf8"),
          extension: path.extname(full).slice(1) || "html"
        });
      } catch {
        // 読めないファイルは無視
      }
    }
  }

  walk(rootDir);

  // 対象ファイル自体は必ず含める
  try {
    const targetText = fs.readFileSync(target, "utf8");
    if (!sources.some(x => x.raw === targetText)) {
      sources.unshift({
        raw: targetText,
        extension: path.extname(target).slice(1) || "jsx"
      });
    }
  } catch {
    // buildBundle 側で詳細なエラーになる
  }

  return sources;
}

async function buildTailwindCss() {
  const input = `
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    html, body, #root { min-height: 100%; }
    body { margin: 0; }
    * { box-sizing: border-box; }
  `;

  const config = {
    content: [
      ...collectTailwindSources(targetDir),
      { raw: Object.values(SHADCN_COMPONENTS).join("\n"), extension: "jsx" }
    ],
    theme: { extend: {} },
    plugins: []
  };

  const result = await postcss([
    tailwindcss(config),
    autoprefixer
  ]).process(input, { from: undefined });

  return result.css;
}

function htmlPage() {
  const safeName = targetName.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeName} - JSX Viewer</title>
  <link rel="stylesheet" href="/style.css" />
  <style>
    #viewer-bar {
      position: sticky; top: 0; z-index: 2147483647;
      display: flex; align-items: center; gap: 10px;
      min-height: 42px; padding: 6px 12px;
      font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
      background: #111827; color: white;
      box-shadow: 0 1px 4px rgba(0,0,0,.25);
    }
    #viewer-bar .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    #viewer-bar button {
      border: 1px solid #4b5563; border-radius: 6px; padding: 5px 10px;
      background: #1f2937; color: white; cursor: pointer;
    }
    #viewer-error {
      display:none; white-space:pre-wrap; margin:16px; padding:16px;
      border:1px solid #fecaca; background:#fef2f2; color:#991b1b;
      border-radius:8px; font:13px/1.5 Consolas, monospace;
    }
  </style>
</head>
<body>
  <div id="viewer-bar">
    <strong>JSX Viewer</strong>
    <span class="name">${safeName}</span>
    <button onclick="location.reload()">再読み込み</button>
  </div>
  <div id="viewer-error"></div>
  <div id="root"></div>

  <script>
    window.addEventListener("error", e => {
      const box = document.getElementById("viewer-error");
      box.style.display = "block";
      box.textContent = "実行時エラー:\\n" + (e.error?.stack || e.message || e);
    });
    window.addEventListener("unhandledrejection", e => {
      const box = document.getElementById("viewer-error");
      box.style.display = "block";
      box.textContent = "Promise エラー:\\n" + (e.reason?.stack || e.reason || e);
    });
  </script>
  <script src="/bundle.js"></script>
</body>
</html>`;
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

function listenAvailable(startPort) {
  return new Promise((resolve, reject) => {
    const tryPort = port => {
      const server = http.createServer(async (req, res) => {
        try {
          if (req.url === "/bundle.js") {
            const js = await buildBundle();
            res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
            res.end(js);
            return;
          }

          if (req.url === "/style.css") {
            const css = await buildTailwindCss();
            res.writeHead(200, { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store" });
            res.end(css);
            return;
          }

          if (req.url === "/__ping") {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("ok");
            return;
          }

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
          res.end(htmlPage());
        } catch (err) {
          const details = err?.errors?.map(e => e.text + (e.location ? `\n  ${e.location.file}:${e.location.line}:${e.location.column}` : "")).join("\n\n")
            || err?.stack || String(err);

          if (req.url === "/bundle.js") {
            const payload = JSON.stringify(details);
            res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
            res.end(`
              const box = document.getElementById("viewer-error");
              box.style.display = "block";
              box.textContent = "ビルドエラー:\\n" + ${payload};
            `);
          } else {
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end(details);
          }
        }
      });

      server.once("error", err => {
        if (err.code === "EADDRINUSE") tryPort(port + 1);
        else reject(err);
      });

      server.listen(port, "127.0.0.1", () => resolve({ server, port }));
    };
    tryPort(startPort);
  });
}

const { server, port } = await listenAvailable(PORT_START);
const url = `http://127.0.0.1:${port}/`;

console.log("");
console.log("==========================================");
console.log(" Claude JSX Viewer v1.1");
console.log("==========================================");
console.log(` File : ${target}`);
console.log(` URL  : ${url}`);
console.log("");
console.log("このウィンドウを閉じると Viewer も終了します。");
console.log("JSXを編集した後はブラウザの「再読み込み」を押してください。");
console.log("");

openBrowser(url);

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
