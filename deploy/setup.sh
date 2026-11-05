#!/usr/bin/env bash
# Instala la tienda en un VPS con Ubuntu o Debian: Node, nginx, HTTPS (Let's Encrypt) y el servicio.
# Se puede volver a correr sin problema (por ejemplo, para cambiar de rama).
#
# Uso (como root):
#   EMAIL=tu@correo.com bash setup.sh
#
# Variables opcionales:
#   DOMAIN    dominio (por defecto lonier.mx)
#   REPO_URL  repositorio (por defecto git@github.com:ReymenSolutions/lonier-web.git)
#   BRANCH    rama a publicar (por defecto main)
#   APP_PORT  puerto interno de la tienda (por defecto 3100)
set -euo pipefail

DOMAIN="${DOMAIN:-lonier.mx}"
EMAIL="${EMAIL:-}"
REPO_URL="${REPO_URL:-git@github.com:ReymenSolutions/lonier-web.git}"
BRANCH="${BRANCH:-main}"
APP_PORT="${APP_PORT:-3100}"
APP_DIR=/srv/lonier-web
ENV_DIR=/etc/lonier
ENV_FILE="$ENV_DIR/lonier.env"

step() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Corre este script como root: sudo EMAIL=tu@correo.com bash setup.sh"
[[ -n "$EMAIL" ]] || fail "Falta tu correo para el certificado HTTPS: EMAIL=tu@correo.com bash setup.sh"
. /etc/os-release
[[ "$ID" == ubuntu || "$ID" == debian ]] || fail "Este script es para Ubuntu o Debian (tu sistema: $PRETTY_NAME)."
if ss -ltn "sport = :$APP_PORT" | grep -q LISTEN && ! systemctl is-active --quiet lonier; then
  fail "El puerto $APP_PORT ya lo usa otro programa. Elige otro: APP_PORT=3200 EMAIL=$EMAIL bash setup.sh"
fi

step "Instalando paquetes (nginx, git, certbot)"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx git curl ca-certificates certbot python3-certbot-nginx >/dev/null

if ! command -v node >/dev/null || (( $(node -p 'process.versions.node.split(".")[0]') < 20 )); then
  step "Instalando Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
fi
echo "Node $(node -v)"

step "Usuario del sistema 'lonier'"
id lonier &>/dev/null || useradd --system --no-create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin lonier

step "Descargando la tienda ($REPO_URL, rama $BRANCH)"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" checkout --quiet -B "$BRANCH" "origin/$BRANCH"
  git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  if [[ "$REPO_URL" == git@github.com:* ]] && ! ssh-keygen -F github.com &>/dev/null; then
    mkdir -p ~/.ssh && ssh-keyscan -t ed25519 github.com 2>/dev/null >> ~/.ssh/known_hosts
  fi
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR" || fail "No se pudo clonar el repositorio. Si es privado, agrega la llave de despliegue (ver README → VPS)."
fi
chmod -R a+rX "$APP_DIR"

step "Archivo de configuración $ENV_FILE"
mkdir -p "$ENV_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  {
    echo "PORT=$APP_PORT"
    grep -v -e '^SITE_URL=' -e '^PORT=' "$APP_DIR/.env.example"
    echo "SITE_URL=https://$DOMAIN"
  } > "$ENV_FILE"
  echo "Creado. Llénalo con tus llaves y luego corre: systemctl restart lonier"
else
  sed -i "s/^PORT=.*/PORT=$APP_PORT/" "$ENV_FILE"
  echo "Ya existía; se conservan tus llaves."
fi
chown root:lonier "$ENV_FILE"
chmod 640 "$ENV_FILE"

step "Servicio systemd"
install -m 644 "$APP_DIR/deploy/lonier.service" /etc/systemd/system/lonier.service
systemctl daemon-reload
systemctl enable --quiet lonier
systemctl restart lonier
for _ in {1..20}; do
  curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/" && break
  sleep 0.5
done
curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/" || fail "La tienda no arrancó. Revisa: journalctl -u lonier -n 50"
echo "La tienda responde en el puerto $APP_PORT."

step "Configurando nginx para $DOMAIN"
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$APP_PORT/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/lonier
ln -sf /etc/nginx/sites-available/lonier /etc/nginx/sites-enabled/lonier
nginx -t
systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  step "Abriendo puertos 80 y 443 en el firewall (ufw)"
  ufw allow 'Nginx Full' >/dev/null
fi

step "Revisando que el DNS de $DOMAIN apunte a este servidor"
SERVER_IP="$(curl -4 -fsS https://api.ipify.org || true)"
DNS_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}' || true)"
WWW_IP="$(getent ahostsv4 "www.$DOMAIN" | awk 'NR==1 {print $1}' || true)"
echo "IP de este servidor: ${SERVER_IP:-?}  ·  $DOMAIN → ${DNS_IP:-(sin registro)}  ·  www.$DOMAIN → ${WWW_IP:-(sin registro)}"
if [[ -z "$SERVER_IP" || "$DNS_IP" != "$SERVER_IP" || "$WWW_IP" != "$SERVER_IP" ]]; then
  printf '\n\033[1;33m! El DNS todavía no apunta aquí, así que no se pidió el certificado HTTPS.\033[0m\n'
  echo "  Configura en GoDaddy los registros del README, espera unos minutos y vuelve a correr este script."
  exit 0
fi

step "Certificado HTTPS (Let's Encrypt)"
certbot --nginx --non-interactive --agree-tos -m "$EMAIL" -d "$DOMAIN" -d "www.$DOMAIN" --redirect
systemctl reload nginx

step "Listo"
echo "Tienda publicada en https://$DOMAIN"
echo "Configuración: $ENV_FILE  (después de editarlo: systemctl restart lonier)"
echo "Registros:     journalctl -u lonier -f"
echo "Actualizar:    bash $APP_DIR/deploy/update.sh"
