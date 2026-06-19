#!/usr/bin/env zsh
# deploy.sh — bellio-cms デプロイヘルパー
#
# 使い方:
#   ./deploy.sh staging      # bellio-cms-staging にプレビューデプロイ
#   ./deploy.sh prod         # bellio-cms 本番デプロイ

set -e

TARGET="${1:-staging}"
SCOPE="callmintai"
ORG_ID="team_gFxyHcnBvbyVW5m5Mz9x1RIV"
LINK=".vercel/project.json"

write_project() {
  local project_id="$1"
  local project_name="$2"
  printf '{"projectId":"%s","orgId":"%s","projectName":"%s"}\n' \
    "$project_id" "$ORG_ID" "$project_name" > "$LINK"
}

restore() {
  write_project "prj_q6T4n7EvQDtEDv8PHxc4rxjP8EEr" "bellio-cms"
}

case "$TARGET" in
  staging)
    echo "→ bellio-cms-staging にデプロイ中..."
    write_project "prj_jTy4HyEBmLdzZdjh1WSNGuuyz5Ud" "bellio-cms-staging"
    trap restore EXIT
    npx vercel --yes --scope "$SCOPE"
    ;;
  prod|production)
    echo "→ bellio-cms 本番にデプロイ中..."
    restore
    npx vercel --prod --yes --scope "$SCOPE"
    ;;
  *)
    echo "使い方: ./deploy.sh [staging|prod]"
    exit 1
    ;;
esac
