# クイックスタート

## インストール

[ダウンロード](/ja/download) ページでお使いのプラットフォーム向けインストーラーを入手し、以下の手順に従ってください。

- **Windows**: `.exe` インストーラーをダブルクリックしてウィザードに従います。
- **macOS**: `.dmg` を開き、アプリをアプリケーションフォルダにドラッグします。macOS が「壊れている」と表示する場合は [FAQ](/ja/docs/faq) を参照してください。
- **Linux**: `.deb` / `.rpm` パッケージでインストールするか、`.AppImage` を直接実行します。

まだ正式リリースがない場合は、[ソースからビルドする](/ja/download#ソースからビルドする) を参照してご自身でコンパイルしてください。

## インターフェースの構成

アプリは 3 つのエリアに分かれています：

**左サイドバー**: キーワード検索バー付きで全ツールを一覧表示。最近使ったツールは下部に表示されます。ツールをクリックすると右側のタブで開きます。

**右マルチタブエリア**: 各ツールが独自のタブを持ちます。好きなだけ開いても互いに干渉しません。タブを閉じても未保存のコンテンツは保持され（ツールを再度開くと復元されます）。

**AI パネル**: 右上の AI アイコンをクリックしてサイドパネルを展開します。どのツール画面からでも利用可能 — コンテンツを貼り付けて直接質問できます。会話履歴はローカルデータベースに自動保存されます。

## AI アシスタントの設定

初回使用前にプロバイダーを設定する必要があります：

1. 右上のツールバーにある**設定**アイコンをクリック（または `Ctrl/Cmd + ,` を押す）。
2. **AI アシスタント**タブに移動してプロバイダーを選択：

| プロバイダー | API Key 必要 |
|-------------|-------------|
| Claude (Anthropic) | あり |
| OpenAI | あり |
| DeepSeek | あり |
| Codex (OpenAI Codex) | あり |
| Grok (xAI) | あり |
| Ollama（ローカル） | なし — BaseURL を設定するだけ |

3. API Key を入力（Ollama の場合はローカルアドレス — デフォルト `http://localhost:11434`）し、**接続テスト**をクリックして確認します。
4. 設定を保存して閉じます。AI パネルが使用できるようになります。

> **プロキシが必要なユーザーへ:** 一部の地域では OpenAI、Claude、Grok へのアクセスにプロキシが必要です。DeepSeek と Ollama（ローカル）はプロキシなしで動作します。

## 開発者向け：新しいツールを追加する

3 つのステップで完了します：

**ステップ 1**: `packages/ui/src/tools/<id>/` に `meta.ts` と `Tool.vue` を作成します：

```ts
// packages/ui/src/tools/my-tool/meta.ts
import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'my-tool',
  name: { zh: '我的工具', en: 'My Tool' },
  desc: { zh: '工具简介', en: 'Tool description' },
  category: 'misc',
  keywords: ['my-tool'],
  icon: '🔧',
  load: () => import('./Tool.vue'),
}
```

**ステップ 2**: `packages/ui/src/tools/index.ts` の `TOOLS` 配列の末尾に登録します：

```ts
import { meta as myTool } from './my-tool/meta'

export const TOOLS: ToolMeta[] = [
  // ...既存のツール
  myTool,
]
```

**ステップ 3**: `pnpm dev` を実行します — 新しいツールが左サイドバーにすぐ表示されます。
