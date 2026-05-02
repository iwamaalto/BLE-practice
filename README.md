# 手書きノート × Claude

ブラウザ上で手書きできるノートアプリ。**「AIペン」で手書きの質問を囲うと、Claude が読み取って回答を直下に手書き風で書き込みます。**

iPad + Apple Pencil での利用を想定。

## しくみ

```
[ブラウザ canvas] --(囲み領域の PNG)--> [Express] --(claude --print @img.png)--> [Claude]
                                                       ↑
                                            サブスク認証 (oauth_token) を継承
```

- フロント: 素の HTML + Canvas + Pointer Events
- バックエンド: Express + `claude` CLI を `child_process.spawn` で呼び出し
- Anthropic API キーは **不要**。`claude` CLI が既にログイン済み（Pro / Max サブスク）であればそのまま使われる

## 必要な環境

- Node.js 18+
- `claude` CLI が PATH 上にあり、ログイン済みであること
  - `claude auth status` で `loggedIn: true` を確認

## 起動

```bash
cd server
npm install
npm start
```

ブラウザで http://localhost:3000 を開く。

## 使い方

1. **黒ペン**で質問を手書き（例: `2 + 3 = ?`）
2. ツールバーで **AIペン** に切り替え、質問を囲む（始点と終点が近づいた閉ループのみ反応）
3. 数秒待つと、囲みの直下に手書き風で回答が書き込まれる

### ツールバー

| ボタン | 動作 |
| --- | --- |
| 黒ペン | 通常の筆記。AI は反応しない |
| AIペン（紫） | このペンで囲うと AI が起動 |
| 細 / 中 / 太 | 線の太さ（2 / 4 / 8px） |
| 消しゴム | 部分消去（destination-out） |
| クリア | 全消去（確認あり） |

### 反応しない条件

- AIペンの線が「閉じていない」（始点と終点が離れている）
- 囲みが小さすぎる（バウンディングボックス対角 80px 未満）
- 黒ペンで囲んだ場合（AIペンのみがトリガ）

## 環境変数

| 変数 | デフォルト | 用途 |
| --- | --- | --- |
| `PORT` | `3000` | サーバーポート |
| `CLAUDE_MODEL` | `sonnet` | 使用モデルのエイリアスまたは正式名 |

## ファイル構成

```
.
├── README.md
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── server/
    ├── package.json
    └── server.js
```
