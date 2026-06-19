# bellio-cms 開発ルール

## デプロイワークフロー（厳守）

**staging → 確認 → prod** の順序を必ず守る。本番への直接デプロイ禁止。

### 手順

1. `staging` ブランチで作業・コミット
2. `git push origin staging`
3. `./deploy.sh staging` でステージング環境にデプロイ
4. ユーザーがステージング URL で動作確認
5. 確認 OK → `staging` → `main` の PR を作成・マージ
6. `./deploy.sh prod` で本番デプロイ

### デプロイ先

| コマンド | Vercel プロジェクト | 用途 |
|---|---|---|
| `./deploy.sh staging` | `bellio-cms-staging` | 動作確認用 |
| `./deploy.sh prod` | `bellio-cms` | 本番（bellioai.com） |

### 禁止事項

- `main` ブランチへの直接コミット・プッシュ
- `./deploy.sh prod` をステージング確認前に実行すること
- Vercel ダッシュボードからの手動プロモート（ワークフローが崩れる）

## その他の開発ルール

- DB スキーマ変更は `bellio/supabase/migrations/` に migration ファイルを追加する
- マイグレーションは Supabase ダッシュボードの SQL Editor で手動適用（Supabase CLI は使わない）
- 最小差分の原則：指定されたファイルのみ変更し、無関係なリファクタは行わない
