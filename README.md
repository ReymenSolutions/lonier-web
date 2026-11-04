# Lonier Skin — tienda en línea

Tienda de Lonier Skin hecha con HTML, CSS y JavaScript, sin frameworks. El cobro se hace con **Mercado Pago** y **Stripe**. Corre en un VPS con `server.js` detrás de nginx (o en Vercel sin cambios). Los pedidos y el inventario se guardan en Upstash Redis y los avisos de venta llegan por correo (Resend).

## Páginas

| Ruta | Archivo | Qué hace |
| --- | --- | --- |
| `/` | `index.html` | Portada: beneficios, cómo usar, opiniones y preguntas frecuentes |
| `/tienda` | `tienda.html` | Catálogo, generado desde `js/store.js` |
| `/producto?id=…` | `producto.html` | Ficha del producto con paquetes de 1, 2 y 3 piezas, aviso de inventario y datos estructurados para Google |
| `/carrito` | `carrito.html` | Carrito, barra de progreso hacia el envío gratis, datos de envío y pago |
| `/gracias` | `gracias.html` | Resultado del pago: aprobado, pendiente (OXXO) o rechazado |
| `/politicas` | `politicas.html` | Envíos, devoluciones, términos y aviso de privacidad (**plantilla: completa lo que está entre [corchetes]**) |
| `/admin` | `admin.html` | Panel privado: pedidos pagados, marcar como enviado con guía, inventario y descarga en CSV |

## Cómo funciona una venta

1. El cliente paga en Mercado Pago o Stripe. Al iniciar el pago se revisa que haya inventario y se guarda el pedido como *pendiente*.
2. La pasarela avisa a la tienda (`/api/webhooks/mercadopago` o `/api/webhooks/stripe`) cuando el pago se confirma, incluidos los pagos en OXXO, que llegan después.
3. La tienda marca el pedido como **pagado**, descuenta el inventario y te manda un **correo** con productos, dirección, teléfono y un enlace al WhatsApp del cliente. Si el inventario queda bajo, el correo también te avisa.
4. El pedido aparece en `/admin`. Cuando lo envías, lo marcas como enviado y escribes la guía; si configuraste `EMAIL_FROM`, al cliente le llega un correo con su guía.

Los avisos repetidos de la pasarela no duplican el pedido ni descuentan inventario dos veces.

## Cómo está organizado

- `js/store.js`: **el único lugar donde se cambian precios, productos, envío, inventario bajo, WhatsApp, el enlace a Mercado Libre y las IDs de Meta Pixel y Google Analytics.** Lo usan tanto la página como el servidor.
- `js/cart.js`: el carrito, guardado en el navegador.
- `js/layout.js`: encabezado, barra de envío gratis, pie de página, carrito lateral y botón de WhatsApp.
- `js/stock.js`: muestra "Agotado" o "¡Solo quedan N piezas!".
- `js/analytics.js`: Meta Pixel y Google Analytics 4.
- `api/checkout/*`: crean el pago en Mercado Pago o Stripe. **El total se calcula en el servidor** con los precios del catálogo.
- `api/webhooks/*`: reciben la confirmación del pago.
- `api/admin.js`, `api/stock.js`: panel e inventario público.
- `api/_lib/`: pedidos e inventario en Redis (`orders.js`), correos (`notify.js`) y el proceso de un pago confirmado (`fulfill.js`).

## Cambios habituales

- **Precio o descuento:** `price` y `compareAtPrice` en `js/store.js`.
- **Envío:** `STORE.shipping.fee` (hoy $99) y `freeFromQty` (hoy 3 piezas; usa `null` para quitar el envío gratis).
- **Inventario:** desde `/admin`. Cuando vendas en Mercado Libre, resta las piezas ahí.
- **Botón de Mercado Libre:** `STORE.mercadoLibreUrl`.
- **Fotos:** van en `assets/` en formato WebP y se listan en `images` del producto en `js/store.js`; la primera es la principal. `assets/og-image.jpg` (1200×630) es la imagen que aparece al compartir el enlace en WhatsApp o Facebook. Si una foto no carga se muestra `assets/serum-placeholder.svg`.

## Publicar en tu VPS con lonier.mx

La tienda corre con `server.js` (Node, sin dependencias) detrás de nginx, con HTTPS gratis de Let's Encrypt. Se necesita un VPS con **Ubuntu 22.04/24.04 o Debian 12** y acceso por SSH como root.

### 1. DNS en GoDaddy

En GoDaddy: **Mi cuenta → Mis productos → Dominios → lonier.mx → DNS → Registros DNS**.

| Tipo | Nombre | Valor | TTL |
| --- | --- | --- | --- |
| A | `@` | la IP pública de tu VPS | 600 segundos |
| CNAME | `www` | `lonier.mx.` (o `@`) | 1 hora |

- **Edita** el registro `A @` que ya existe (GoDaddy lo crea con el valor "Parked" o una IP suya). No agregues un segundo `A @`.
- Si hay un registro **AAAA** con nombre `@` o `www`, bórralo, a menos que sea la IPv6 de tu VPS.
- En **Reenvío (Forwarding)** no debe haber nada activo para el dominio, porque se salta los registros de arriba.
- No toques los registros **MX** ni **TXT** si ya usas correo con el dominio.
- Si en **Servidores de nombres (Nameservers)** no dice "GoDaddy" (por ejemplo, Cloudflare), estos registros se hacen allá y no en GoDaddy.

Puedes revisar que ya apunte con:

```bash
dig +short lonier.mx
```

```bash
dig +short www.lonier.mx
```

Ambos deben responder la IP de tu VPS. Normalmente tarda de 5 a 30 minutos y, en casos raros, hasta 48 horas.

### 2. Acceso del VPS al repositorio (si es privado)

En el VPS, como root, crea una llave y muéstrala:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C "vps-lonier"
```

```bash
cat ~/.ssh/id_ed25519.pub
```

Cópiala en GitHub: **repositorio → Settings → Deploy keys → Add deploy key** (solo lectura).

### 3. Instalar

Elige según lo que ya tenga tu VPS. Para saberlo:

```bash
docker ps --format '{{.Names}}  {{.Image}}' | grep -i proxy
```

#### Opción A: VPS con Docker y nginx-proxy (si el comando de arriba muestra `nginxproxy/nginx-proxy`)

La tienda corre como un contenedor más. nginx-proxy la publica en `lonier.mx` y `www.lonier.mx`, y acme-companion saca el HTTPS solo. No se toca ningún otro sitio del servidor.

Primero, averigua en qué red de Docker está nginx-proxy:

```bash
docker inspect nginx-proxy -f '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

Luego, como root (cambia `NOMBRE-DE-LA-RED` por lo que respondió el comando anterior):

```bash
cd /srv/lonier-web && cp -n .env.example .env && chmod 600 .env
```

```bash
PROXY_NETWORK=NOMBRE-DE-LA-RED docker compose up -d --build
```

Para no escribir la red cada vez, guárdala en un archivo que docker compose lee solo:

```bash
echo "PROXY_NETWORK=NOMBRE-DE-LA-RED" >> /srv/lonier-web/.env
```

Revisa que arrancó y que acme-companion pidió el certificado (tarda 1 o 2 minutos después de que el DNS apunte al VPS):

```bash
docker logs -f lonier-web
```

```bash
docker logs acme-companion 2>&1 | grep -i lonier
```

Para publicar cambios nuevos:

```bash
cd /srv/lonier-web && git pull && docker compose up -d --build
```

#### Opción B: VPS sin Docker

En el VPS, como root (cambia el correo; se usa para avisos de Let's Encrypt):

```bash
git clone git@github.com:ReymenSolutions/lonier-web.git /srv/lonier-web
```

```bash
EMAIL=tu@correo.com bash /srv/lonier-web/deploy/setup.sh
```

El script instala Node 22, nginx y certbot. Además crea el servicio `lonier`, configura nginx para `lonier.mx` (y redirige `www.lonier.mx` a `lonier.mx`) y pide el certificado HTTPS. Si el DNS todavía no apunta al VPS, deja todo listo sin HTTPS: vuelve a correrlo cuando el DNS esté listo. **No lo uses si los puertos 80 y 443 ya los ocupa Docker u otro servidor web.**

Variables opcionales: `BRANCH` (rama a publicar, por defecto `main`) y `APP_PORT` (puerto interno, por defecto `3100`). El script no modifica otros sitios que tengas en nginx.

### 4. Llaves y servicios

Las llaves van en un archivo (todas las variables están explicadas ahí):

- **Opción A (Docker):** `nano /srv/lonier-web/.env` y luego `cd /srv/lonier-web && docker compose up -d`.
- **Opción B (sin Docker):** `nano /etc/lonier/lonier.env` y luego `systemctl restart lonier`.

1. **Base de datos:** crea una base Redis gratis en [upstash.com](https://upstash.com) y copia `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` de la pestaña *REST API*.
2. **Correos:** crea una cuenta en [resend.com](https://resend.com) y llena `RESEND_API_KEY` y `ORDER_EMAIL_TO` (tu correo). Para escribirles también a tus clientes, en Resend **Domains → Add domain → lonier.mx**: Resend te da unos registros (MX y TXT de `send` y `resend._domainkey`) que agregas en el DNS de GoDaddy igual que arriba. Cuando aparezca "Verified", pon `EMAIL_FROM="Lonier Skin <pedidos@lonier.mx>"`.
3. **Panel:** `ADMIN_PASSWORD` con una contraseña larga.
4. **Mercado Pago:** `MP_ACCESS_TOKEN`. Los avisos de pago se configuran solos. Opcional: en **Tus integraciones → Webhooks**, copia la clave secreta a `MP_WEBHOOK_SECRET`.
5. **Stripe:** `STRIPE_SECRET_KEY`. En **Developers → Webhooks → Add endpoint** usa `https://lonier.mx/api/webhooks/stripe` con los eventos `checkout.session.completed` y `checkout.session.async_payment_succeeded`, y copia el *Signing secret* a `STRIPE_WEBHOOK_SECRET`.
6. **Medición:** pon tus IDs en `STORE.analytics` dentro de `js/store.js`:
   - `metaPixelId`: Meta → Administrador de eventos → tu conjunto de datos → ID (solo números).
   - `ga4Id`: Google Analytics → Administrar → Flujos de datos → ID de medición (`G-…`).

   Se registran estos eventos: vista de página, vista de producto (`ViewContent` / `view_item`), agregar al carrito (`AddToCart` / `add_to_cart`), inicio de pago (`InitiateCheckout` / `begin_checkout`) y compra (`Purchase` / `purchase`, una sola vez por pedido).
7. **Prueba todo** con credenciales de prueba (`TEST-…`, `sk_test_…`) y luego cámbialas por las de producción.

### Día a día en el VPS (opción B; con Docker usa `docker logs -f lonier-web` y `docker compose up -d --build`)

| Para | Comando |
| --- | --- |
| Publicar cambios nuevos del repositorio | `bash /srv/lonier-web/deploy/update.sh` |
| Ver qué está pasando (errores, avisos de pago) | `journalctl -u lonier -f` |
| Reiniciar después de cambiar llaves | `systemctl restart lonier` |
| Ver si está corriendo | `systemctl status lonier` |

El certificado HTTPS se renueva solo (certbot instala un temporizador).

### Alternativa: Vercel

La tienda también funciona en Vercel sin cambios (`vercel.json` y las funciones de `api/` siguen el formato de Vercel). Las variables son las mismas; la base de datos se puede conectar desde **Storage → Upstash**.

## Desarrollo local

```bash
cp .env.example .env
```

```bash
node --env-file=.env server.js
```

La tienda queda en `http://127.0.0.1:3000`. Las pruebas se corren con:

```bash
npm test
```

## Pendientes conocidos

- **WhatsApp automático:** hoy los avisos llegan por correo. Para recibirlos por WhatsApp se necesita la API de WhatsApp Business (Meta o Twilio), que cobra por mensaje y requiere aprobar plantillas.
- **Mercado Libre:** el inventario no se sincroniza solo con Mercado Libre. Hay que restar las ventas de Mercado Libre en `/admin`. Se podría automatizar con la API de Mercado Libre.
- **Meta Conversions API:** el Pixel mide desde el navegador. Si muchas personas usan bloqueadores de anuncios, conviene enviar también las compras desde el servidor.
- **Pagos en OXXO con Stripe:** el cliente ve la página de "gracias" al generar su ficha, aunque todavía no haya pagado. El pedido solo se marca como pagado (y te llega el correo) cuando Stripe confirma el pago.
