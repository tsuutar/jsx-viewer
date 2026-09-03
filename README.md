# JSX Viewer

Version 1.1

Claude / ChatGPT などが生成した `.jsx` / `.tsx` を、できるだけ手軽にローカル表示するためのビューアーです。

## 必要なもの

- Windows 11
- Node.js LTS
- 初回のみインターネット接続（npm install 用）

## 最短の使い方

1. `jsx-viewer` フォルダを任意の場所へ置く
2. `.jsx` または `.tsx` を `viewer.bat` へドラッグ＆ドロップ
3. 初回だけ `npm install` が自動実行される
4. ブラウザが自動で開く

`viewer.bat` を普通にダブルクリックした場合は、ファイル選択ダイアログが開きます。

## 対応しているもの

- React JSX / TSX
- React 19
- Tailwind CSS クラス
- `lucide-react`
- `recharts`
- `framer-motion`
- 対象 JSX からの相対 import
- `@/...` を対象 JSX のあるディレクトリ基準で解決
- Claude Artifacts で頻出する一部 `@/components/ui/*` を簡易スタブで表示

簡易対応済み shadcn/ui:

- button
- card
- input
- textarea
- label
- badge
- separator
- tabs
- alert
- switch

## 例

```jsx
import React, { useState } from "react";
import { Search } from "lucide-react";

export default function Sample() {
  const [count, setCount] = useState(0);

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow">
        <Search className="mb-3 h-6 w-6" />
        <h1 className="text-2xl font-bold">Claude JSX Viewer</h1>
        <button
          className="mt-4 rounded bg-slate-900 px-4 py-2 text-white"
          onClick={() => setCount((v) => v + 1)}
        >
          count: {count}
        </button>
      </div>
    </main>
  );
}
```

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

JSX は通常の JavaScript としてブラウザ上で実行されます。
出所の分からない JSX を開かないでください。

この Viewer は localhost のみで待ち受けますが、表示したコード自体はブラウザの JavaScript として動作します。

## Windows の「送る」に登録する場合

`viewer.bat` のショートカットを次へ置くと便利です。

```text
%APPDATA%\Microsoft\Windows\SendTo
```

すると JSX を右クリック → `送る` → JSX Viewer のように開けます。
