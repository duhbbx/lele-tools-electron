#!/usr/bin/env bash
# 一键发布官网.
#
# 用法:
#   1. 配 deploy target (一次性):
#      cp apps/website/.env.deploy.example apps/website/.env.deploy
#      # 在 .env.deploy 里填 LELE_WEB_DEPLOY_HOST / WEBROOT / DOMAIN
#   2. bash apps/website/deploy.sh
#
# 也可以直接走 env var:
#   LELE_WEB_DEPLOY_HOST=1.2.3.4 LELE_WEB_DEPLOY_WEBROOT=/var/www/foo \
#     bash apps/website/deploy.sh
#
# 鉴权策略 (自动探测,无需手动选):
#   1. 优先 SSH 公钥免密 (推荐) — 已 ssh-copy-id 过就直接走,零交互
#   2. 退化 sshpass + 密码 — 需 brew install hudochenkov/sshpass/sshpass
#      密码来源: SSHPASS env > 终端 read -s 输入
#
# rsync 同步完会在服务器侧统一 chown www-data + chmod 644/755 + nginx -s reload
# (macOS 默认 600 让 nginx 403,所以一定要 chmod 一遍)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 自动 source .env.deploy (gitignored, 本地敏感配置), 让用户不必每次手 export
if [ -f "$SCRIPT_DIR/.env.deploy" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/.env.deploy"
  set +a
fi

# Host/webroot/domain 必填 — 不内联默认值, 避免源码泄漏部署目标
HOST="${LELE_WEB_DEPLOY_HOST:?Set LELE_WEB_DEPLOY_HOST (or fill apps/website/.env.deploy)}"
USER="${LELE_WEB_DEPLOY_USER:-root}"
WEBROOT="${LELE_WEB_DEPLOY_WEBROOT:?Set LELE_WEB_DEPLOY_WEBROOT}"
DOMAIN="${LELE_WEB_DEPLOY_DOMAIN:?Set LELE_WEB_DEPLOY_DOMAIN}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▶ 1/3 构建产物..."
pnpm --filter @lele/website build

DIST="$SCRIPT_DIR/.vitepress/dist"
if [ ! -d "$DIST" ]; then
  echo "❌ 构建产物目录不存在: $DIST" >&2
  exit 1
fi
SIZE=$(du -sh "$DIST" | awk '{print $1}')
echo "▶ 产物大小: $SIZE"

# ── 鉴权探测 ────────────────────────────────────────────────────────
# BatchMode=yes 关闭交互,3 秒探测无密钥 / 网络问题不卡;成功 = ssh-key OK
if ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new \
     "$USER@$HOST" 'exit 0' 2>/dev/null; then
  echo "▶ 使用 SSH 公钥免密 (探测通过)"
  RSYNC_E="ssh -o StrictHostKeyChecking=accept-new"
  SSH="ssh -o StrictHostKeyChecking=accept-new"
else
  echo "▶ SSH 公钥不可用,降级到密码鉴权"
  command -v sshpass >/dev/null || {
    echo "❌ 需要 sshpass: brew install hudochenkov/sshpass/sshpass" >&2
    echo "   或先配 SSH 公钥免密: ssh-copy-id $USER@$HOST" >&2
    exit 1
  }
  if [ -z "${SSHPASS:-}" ]; then
    read -rsp "▶ 输入 $USER@$HOST 密码: " SSHPASS
    echo
  fi
  export SSHPASS
  RSYNC_E="sshpass -e ssh -o StrictHostKeyChecking=accept-new"
  SSH="sshpass -e ssh -o StrictHostKeyChecking=accept-new"
fi

echo "▶ 2/3 rsync 同步到 $USER@$HOST:$WEBROOT/ ..."
rsync -avz --delete -e "$RSYNC_E" "$DIST/" "$USER@$HOST:$WEBROOT/"

echo "▶ 3/3 服务器侧:归一所有者 + 权限 + reload nginx..."
# macOS 自带 rsync 不支持 --chmod=D/F 语法,改成传完后服务器端统一 chmod。
$SSH "$USER@$HOST" "
  chown -R www-data:www-data $WEBROOT &&
  find $WEBROOT -type d -exec chmod 755 {} \; &&
  find $WEBROOT -type f -exec chmod 644 {} \; &&
  nginx -t && nginx -s reload && echo OK
"

echo ""
echo "▶ IndexNow 推 sitemap URL 给 Bing/Yandex/Naver/Seznam ..."
node "$SCRIPT_DIR/scripts/indexnow.mjs" 2>&1 | sed 's/^/  /' || echo "  (失败不阻塞;手动重跑: node $SCRIPT_DIR/scripts/indexnow.mjs)"

echo ""
echo "✅ 部署完成"
echo "   https://$DOMAIN  (DNS 已生效 + 已签 SSL 时)"
echo "   http://$DOMAIN   (HTTP 兜底)"
