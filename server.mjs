import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const requireFromViewer = createRequire(path.join(__dirname, 'package.json'));
const HOST = '0.0.0.0';
const DEFAULT_PORT = 5180;
const configuredPort = Number(process.env.PORT);
const PORT = Number.isInteger(configuredPort) && configuredPort >= 1 && configuredPort <= 65535
  ? configuredPort
  : DEFAULT_PORT;
const JSX_DIR = path.join(__dirname, 'jsx-files');
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
fs.mkdirSync(JSX_DIR, { recursive: true });

const STUBS = {
  button: `import React from 'react'; export const Button=React.forwardRef(function Button({className='',...p},r){return <button ref={r} className={'inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium bg-white hover:bg-slate-50 '+className} {...p}/>})`,
  card: `import React from 'react'; const mk=(t,b)=>React.forwardRef(function C({className='',...p},r){return React.createElement(t,{ref:r,className:b+' '+className,...p})}); export const Card=mk('div','rounded-xl border bg-white shadow-sm'); export const CardHeader=mk('div','p-6'); export const CardTitle=mk('h3','font-semibold'); export const CardDescription=mk('p','text-sm text-slate-500'); export const CardContent=mk('div','p-6 pt-0'); export const CardFooter=mk('div','p-6 pt-0 flex items-center');`,
  input: `import React from 'react'; export const Input=React.forwardRef(function Input({className='',...p},r){return <input ref={r} className={'h-10 w-full rounded-md border px-3 '+className} {...p}/>})`,
  textarea: `import React from 'react'; export const Textarea=React.forwardRef(function Textarea({className='',...p},r){return <textarea ref={r} className={'min-h-20 w-full rounded-md border px-3 py-2 '+className} {...p}/>})`,
  label: `import React from 'react'; export const Label=React.forwardRef(function Label({className='',...p},r){return <label ref={r} className={'text-sm font-medium '+className} {...p}/>})`,
  badge: `import React from 'react'; export function Badge({className='',...p}){return <div className={'inline-flex rounded-full border px-2 py-0.5 text-xs '+className} {...p}/>} `,
  separator: `import React from 'react'; export function Separator({className='',orientation='horizontal',...p}){return <div className={(orientation==='vertical'?'h-full w-px':'h-px w-full')+' bg-slate-200 '+className} {...p}/>} `
};

const safe = s => {
  const base = path.basename(String(s || ''));
  return base.replace(/[<>:"/\\|?*\x00-\x1F]+/g,'_').trim() || 'upload.jsx';
};
const esc = s => String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const allowed = name => /\.(jsx|tsx|js|ts)$/i.test(name);
const fileId = name => Buffer.from(name,'utf8').toString('base64url');
function idToName(id){
  try{
    const name = Buffer.from(String(id||''),'base64url').toString('utf8');
    if(!name || safe(name)!==name || !allowed(name)) return null;
    return name;
  }catch{return null}
}
function listRecords(){
  return fs.readdirSync(JSX_DIR,{withFileTypes:true})
    .filter(x=>x.isFile()&&allowed(x.name))
    .map(x=>{
      const full=path.join(JSX_DIR,x.name),st=fs.statSync(full);
      return {id:fileId(x.name),filename:x.name,size:st.size,updatedAt:st.mtime.toISOString()};
    })
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
function getRecord(id){
  const name=idToName(id); if(!name) return null;
  const full=path.join(JSX_DIR,name); if(!fs.existsSync(full)||!fs.statSync(full).isFile()) return null;
  const st=fs.statSync(full);
  return {id,filename:name,source:fs.readFileSync(full,'utf8'),size:st.size,updatedAt:st.mtime.toISOString()};
}
function uniquePath(filename){
  const base=safe(filename),ext=path.extname(base),stem=path.basename(base,ext);
  let name=base,n=2;
  while(fs.existsSync(path.join(JSX_DIR,name))) name=`${stem} (${n++})${ext}`;
  return path.join(JSX_DIR,name);
}
function saveRecord(filename,source){
  const full=uniquePath(filename);
  fs.writeFileSync(full,source,'utf8');
  const name=path.basename(full),st=fs.statSync(full);
  return {id:fileId(name),filename:name,source,size:st.size,updatedAt:st.mtime.toISOString()};
}
function deleteRecord(id){
  const name=idToName(id); if(!name) return false;
  const full=path.join(JSX_DIR,name); if(!fs.existsSync(full)) return false;
  fs.unlinkSync(full); return true;
}

function plugins(record){ return [{name:'viewer-resolver',setup(build){
  build.onResolve({filter:/^@\/components\/ui\//},a=>({path:a.path.split('/').pop(),namespace:'shadcn'}));
  build.onLoad({filter:/.*/,namespace:'shadcn'},a=>({contents:STUBS[a.path]||`import React from 'react'; export default function X({children,...p}){return <div {...p}>{children}</div>}`,loader:'jsx'}));
  build.onResolve({filter:/^@\/lib\/utils$/},()=>({path:'utils',namespace:'util'}));
  build.onLoad({filter:/.*/,namespace:'util'},()=>({contents:`export function cn(...x){return x.flat().filter(Boolean).join(' ')}`,loader:'js'}));
  build.onResolve({filter:/^[^./][^:]*/},a=>{try{return {path:requireFromViewer.resolve(a.path)}}catch{return null}});
  build.onResolve({filter:/^\.\.?\//},a=>a.namespace==='target'?{path:a.path,namespace:'missing-relative'}:null);
  build.onLoad({filter:/.*/,namespace:'missing-relative'},a=>({errors:[{text:`単体アップロードでは相対 import (${a.path}) を解決できません。`}]}));
}}]; }

async function bundle(record){
  const uploaded={name:'uploaded',setup(build){build.onResolve({filter:/^__TARGET__$/},()=>({path:record.filename,namespace:'target'}));build.onLoad({filter:/.*/,namespace:'target'},()=>({contents:record.source,loader:record.filename.endsWith('.tsx')?'tsx':record.filename.endsWith('.ts')?'ts':'jsx',resolveDir:__dirname}))}};
  const entry=`import React from 'react'; import {createRoot} from 'react-dom/client'; import * as M from '__TARGET__'; const C=M.default??Object.values(M).find(v=>typeof v==='function'); const r=document.getElementById('root'); if(!C){r.innerHTML='<div style="padding:24px;color:#991b1b">表示可能なReactコンポーネントが見つかりません</div>'}else{createRoot(r).render(React.createElement(C))}`;
  const result=await esbuild.build({stdin:{contents:entry,resolveDir:__dirname,sourcefile:'entry.jsx',loader:'jsx'},bundle:true,write:false,outfile:'bundle.js',format:'iife',platform:'browser',target:['es2020'],jsx:'automatic',sourcemap:'inline',define:{'process.env.NODE_ENV':'"development"','global':'window'},loader:{'.js':'jsx','.jsx':'jsx','.ts':'ts','.tsx':'tsx','.css':'css','.svg':'dataurl','.png':'dataurl','.jpg':'dataurl','.jpeg':'dataurl','.gif':'dataurl'},plugins:[uploaded,...plugins(record)],logLevel:'silent'});
  const f=result.outputFiles.find(x=>x.path.endsWith('bundle.js'))||result.outputFiles.find(x=>x.path.endsWith('.js')); if(!f) throw new Error('bundle.js を生成できませんでした'); return f.text;
}
async function css(record){ const input='@tailwind base;@tailwind components;@tailwind utilities;html,body,#root{min-height:100%}body{margin:0}*{box-sizing:border-box}'; const cfg={content:[{raw:record.source,extension:record.filename.split('.').pop()||'jsx'},{raw:Object.values(STUBS).join('\n'),extension:'jsx'}],theme:{extend:{}},plugins:[]}; return (await postcss([tailwindcss(cfg),autoprefixer]).process(input,{from:undefined})).css; }

function indexPage(){return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JSX Viewer</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:#111827;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}.wrap{max-width:900px;margin:auto;padding:16px}.card{background:white;border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin-bottom:16px}.drop{border:2px dashed #9ca3af;border-radius:12px;padding:24px;text-align:center}.btn{display:inline-block;border:0;border-radius:9px;padding:9px 13px;background:#111827;color:white;text-decoration:none;font-weight:600}.danger{background:#fee2e2;color:#991b1b}.secondary{background:#e5e7eb;color:#111827}.item{display:flex;gap:10px;align-items:center;padding:12px 0;border-top:1px solid #eee}.name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.meta{font-size:12px;color:#6b7280}.status{margin-top:10px;font-size:13px;white-space:pre-wrap}@media(max-width:600px){.item{align-items:flex-start;flex-direction:column}}</style></head><body><div class="wrap"><div class="card"><h1>JSX Viewer</h1><p class="meta">スマホから JSX / TSX をアップロードできます。PCで jsx-files フォルダへ直接置いたファイルも一覧から開けます。</p><div class="drop"><input id="file" type="file" accept=".jsx,.tsx,.js,.ts"><br><br><button class="btn" id="upload">アップロードして開く</button><div id="status" class="status"></div></div></div><div class="card"><div style="display:flex;gap:8px;align-items:center"><strong style="flex:1">jsx-files 内のファイル</strong><button class="btn secondary" id="refresh">更新</button></div><div id="list"></div></div></div><script>
const $=s=>document.querySelector(s),st=$('#status');function fmt(n){if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}function eh(s){return s.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}async function load(){const r=await fetch('/api/files'),a=await r.json();$('#list').innerHTML=a.length?a.map(f=>'<div class="item"><div class="name"><strong>'+eh(f.filename)+'</strong><div class="meta">'+new Date(f.updatedAt).toLocaleString()+' ・ '+fmt(f.size||0)+'</div></div><div><a class="btn" href="/preview?id='+encodeURIComponent(f.id)+'">開く</a> <button class="btn danger" data-id="'+f.id+'">削除</button></div></div>').join(''):'<p class="meta">jsx-files フォルダに表示可能なファイルがありません。</p>';document.querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>del(b.dataset.id))}async function up(){const f=$('#file').files[0];if(!f){st.textContent='ファイルを選択してください。';return}st.textContent='アップロード中...';const r=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:f.name,source:await f.text()})});const d=await r.json();if(!r.ok){st.textContent=d.error||'失敗';return}location.href='/preview?id='+encodeURIComponent(d.id)}async function del(id){if(!confirm('削除しますか？'))return;await fetch('/api/files/'+id,{method:'DELETE'});load()}$('#upload').onclick=up;$('#refresh').onclick=load;load();
</script></body></html>`}
function previewPage(r){return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.filename)} - JSX Viewer</title><style>html,body{height:100%;margin:0}body{display:flex;flex-direction:column;background:#fff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}#bar{display:flex;gap:8px;align-items:center;padding:7px 10px;background:#111827;color:white;font:13px system-ui}#bar .n{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#bar a,#bar button{border:1px solid #4b5563;border-radius:7px;padding:6px 9px;background:#1f2937;color:white;text-decoration:none;cursor:pointer}#wrap{flex:1;min-height:0}#preview{display:block;width:100%;height:100%;border:0;background:white}</style></head><body><div id="bar"><a href="/">一覧</a><strong class="n">${esc(r.filename)}</strong><button onclick="document.getElementById('preview').src='/sandbox?id=${r.id}&t='+Date.now()">再読み込み</button></div><div id="wrap"><iframe id="preview" src="/sandbox?id=${r.id}" sandbox="allow-scripts" referrerpolicy="no-referrer" title="${esc(r.filename)}"></iframe></div></body></html>`}

function sandboxPage(r){return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.filename)}</title><link rel="stylesheet" href="/style.css?id=${r.id}"><style>html,body,#root{min-height:100%}body{margin:0}#err{display:none;white-space:pre-wrap;margin:16px;padding:16px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;font:13px/1.5 Consolas,monospace}</style></head><body><div id="err"></div><div id="root"></div><script>function showError(p,v){const b=document.getElementById('err');b.style.display='block';b.textContent=p+'\\n'+(v?.stack||v?.message||String(v))}window.addEventListener('error',e=>showError('実行時エラー:',e.error||e.message));window.addEventListener('unhandledrejection',e=>showError('Promise エラー:',e.reason));</script><script src="/bundle.js?id=${r.id}"></script></body></html>`}
function readBody(req){return new Promise((resolve,reject)=>{let n=0,c=[];req.on('data',x=>{n+=x.length;if(n>MAX_UPLOAD_BYTES){reject(new Error('上限5MBです'));req.destroy();return}c.push(x)});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(c).toString('utf8')))}catch{reject(new Error('JSON解析失敗'))}});req.on('error',reject)})}
function json(res,s,o){res.writeHead(s,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(o))}
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost');try{if(req.method==='GET'&&u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(indexPage())}if(req.method==='GET'&&u.pathname==='/api/files')return json(res,200,listRecords().map(({source,...x})=>x));if(req.method==='POST'&&u.pathname==='/api/upload'){const b=await readBody(req),fn=String(b.filename||''),src=String(b.source||'');if(!/\.(jsx|tsx|js|ts)$/i.test(fn))return json(res,400,{error:'JSX / TSX / JS / TS のみ対応'});if(!src.trim())return json(res,400,{error:'空ファイルです'});const r=saveRecord(fn,src);return json(res,200,{id:r.id,filename:r.filename})}if(req.method==='DELETE'&&u.pathname.startsWith('/api/files/')){const id=u.pathname.split('/').pop();return json(res,200,{ok:deleteRecord(id)})}if(req.method==='GET'&&u.pathname==='/preview'){const r=getRecord(u.searchParams.get('id'));if(!r){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(previewPage(r))}if(req.method==='GET'&&u.pathname==='/sandbox'){const r=getRecord(u.searchParams.get('id'));if(!r){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none';",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});return res.end(sandboxPage(r))}if(req.method==='GET'&&u.pathname==='/bundle.js'){const r=getRecord(u.searchParams.get('id'));if(!r){res.writeHead(404);return res.end('')}try{const js=await bundle(r);res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(js)}catch(e){const d=e?.errors?.map(x=>x.text+(x.location?`\n${x.location.file}:${x.location.line}:${x.location.column}`:'')).join('\n\n')||e.stack||String(e);res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8'});return res.end(`showError('ビルドエラー:',${JSON.stringify(d)});`)}}if(req.method==='GET'&&u.pathname==='/style.css'){const r=getRecord(u.searchParams.get('id'));if(!r){res.writeHead(404);return res.end('')}res.writeHead(200,{'Content-Type':'text/css; charset=utf-8'});return res.end(await css(r))}res.writeHead(404);res.end('Not found')}catch(e){json(res,500,{error:e.message||String(e)})}});
function lans(){const a=[];for(const es of Object.values(os.networkInterfaces()))for(const x of es||[])if(x.family==='IPv4'&&!x.internal)a.push(`http://${x.address}:${PORT}/`);return [...new Set(a)]}
server.listen(PORT,HOST,()=>{console.log('\n==========================================');console.log(' Claude JSX Viewer Server v2.2.1');console.log('==========================================');console.log(`PC     : http://127.0.0.1:${PORT}/`);for(const u of lans())console.log(`LAN    : ${u}`);console.log('\nスマホを同じWi-Fi/LANに接続し、LAN URLへアクセスしてください。');console.log('このウィンドウを閉じるとサーバも停止します。\n');if(process.platform==='win32')spawn('cmd',['/c','start','',`http://127.0.0.1:${PORT}/`],{detached:true,stdio:'ignore',windowsHide:true}).unref()});
