#!/usr/bin/env bash
# Publica la versión más reciente de la rama y reinicia la tienda. Uso: sudo bash update.sh
set -euo pipefail
APP_DIR=/srv/lonier-web
BRANCH="${BRANCH:-$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)}"
[[ $EUID -eq 0 ]] || { echo "Corre como root: sudo bash $0" >&2; exit 1; }

git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
chmod -R a+rX "$APP_DIR"
systemctl restart lonier

PORT="$(grep -E '^PORT=' /etc/lonier/lonier.env | cut -d= -f2)"
for _ in {1..20}; do
  curl -fsS -o /dev/null "http://127.0.0.1:${PORT:-3100}/" && break
  sleep 0.5
done
curl -fsS -o /dev/null "http://127.0.0.1:${PORT:-3100}/" || { echo "La tienda no arrancó: journalctl -u lonier -n 50" >&2; exit 1; }
echo "Actualizada a $(git -C "$APP_DIR" log -1 --format='%h %s')"
