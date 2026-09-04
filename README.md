# JSX Viewer

Claude / ChatGPT などが生成した `.jsx` / `.tsx` を、できるだけ手軽にローカル表示するためのビューアーです。
Windows 11 PCをサーバとして起動し、同じLAN/Wi-Fi上のスマートフォンから JSX / TSX をアップロードしてプレビューできます。

## 最短の使い方

1. `jsx-viewer` フォルダを任意の場所へ置く
2. `.jsx` または `.tsx` を `viewer.bat` へドラッグ＆ドロップ
3. 初回だけ `npm install` が自動実行される
4. ブラウザが自動で開く

## スマホからの操作

URLが表示されるためスマートフォンを同じWi-Fiに接続し、`LAN` のURLへアクセスしてください。

1. `server.bat` を起動
2. JSX / TSX ファイルを選択
3. 「アップロードして開く」
4. プレビュー表示
5. 「一覧」で戻り、アップロード済みファイルを切替
6. 不要なファイルは一覧から削除

### ポート番号を変更する

デフォルトは `5180` です。フォルダ内の `env.bat` を編集して変更できます。

```bat
set "PORT=8080"
```

アップロード済みデータは `uploads` フォルダへ保存されます。

## PC上の .jsx ダブルクリック

従来どおり `.jsx` を `viewer.bat "%1"` に関連付けできます。

- サーバ起動済み: そのサーバへJSXを登録して開く
- サーバ未起動: サーバを自動起動してから登録して開く

`C:\dev\jsx-viewer\viewer.bat` に配置する場合は、付属の `register-jsx-viewer.bat` を利用できます。

## Windows の「送る」に登録する場合

`viewer.bat` のショートカットを次へ置くと便利です。

```text
%APPDATA%\Microsoft\Windows\SendTo
```

すると JSX を右クリック → `送る` → JSX Viewer のように開けます。

## 対応しているもの

- React JSX / TSX
- React 19
- Tailwind CSS クラス
- `lucide-react`
- `recharts`
- `framer-motion`
- 一部の `@/components/ui/*` (shadcn/ui) 簡易表示

## 現在の制約

スマホブラウザからのアップロードは **1ファイル完結型JSX** を前提とします。

例えば以下は単一ファイルアップロードだけでは解決できません。

```jsx
import Header from "./Header.jsx";
```

npmパッケージのimportは、Viewerの `node_modules` に入っているパッケージなら解決できます。

## JSXを修正した場合

ブラウザ上部の「再読み込み」を押してください。
毎回元ファイルを再ビルドするので、コピーは不要です。

## npm パッケージが足りない場合

対象 JSX が例えば次を使っている場合:

```jsx
import { DndContext } from "@dnd-kit/core";
```

ビューアーフォルダで次を実行してください。

```bat
npm install @dnd-kit/core
```

その後ブラウザを再読み込みします。

## Windows のファイル拡張子に登録する場合

`file-extension-register.bat` を実行すると、現在の Windows ユーザーで `.jsx` を JSX Viewer に関連付けできます。
管理者権限は不要です。

このバッチは `C:\dev\jsx-viewer\viewer.bat` に Viewer がある前提です。
別の場所へ移動した場合は、バッチ内の `VIEWER_BAT` のパスを変更してから実行してください。

関連付けを解除する場合は `file-extension-unregister.bat` を実行します。
登録後に Windows が別のアプリで開く場合は、`.jsx` を右クリックして `プログラムから開く` → `別のプログラムを選択` から JSX Viewer を指定してください。

## shadcn/ui について

Claude Artifacts は次のような import を生成することがあります。

```jsx
import { Button } from "@/components/ui/button";
```

この Viewer は頻出コンポーネントについて「見た目確認用」の簡易実装へ差し替えます。

完全な shadcn/ui と同一動作ではありません。
Radix UI に依存する複雑なコンポーネントや高度な interaction は追加対応が必要です。

## セキュリティ上の注意

サーバはLAN利用のため、デフォルトでは `0.0.0.0:5180` で待受します。

- JSXはJavaScriptとして実行されるため、出所不明のJSXを実行しないでください。
