# Lonier Skin — tienda en línea

Tienda de Lonier Skin hecha con HTML, CSS y JavaScript, sin frameworks. El cobro se hace con **Mercado Pago** y **Stripe** mediante funciones serverless en Vercel. Los pedidos y el inventario se guardan en Upstash Redis y los avisos de venta llegan por correo (Resend).

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

## Publicar en Vercel (paso a paso)

1. **Proyecto:** importa el repositorio en [vercel.com/new](https://vercel.com/new). No hay paso de build.
2. **Base de datos:** en Vercel, **Storage → Create → Upstash (Redis)** y conéctala al proyecto. Eso crea `KV_REST_API_URL` y `KV_REST_API_TOKEN` (el plan gratis alcanza de sobra).
3. **Correos:** crea una cuenta en [resend.com](https://resend.com), genera una API key y agrega en Vercel `RESEND_API_KEY` y `ORDER_EMAIL_TO` (tu correo). Sin dominio propio, Resend solo deja enviar al correo de tu cuenta, así que usa ese mismo correo en `ORDER_EMAIL_TO`. Cuando tengas dominio, verifícalo en Resend y agrega `EMAIL_FROM` para que tus clientes también reciban correos.
4. **Panel:** agrega `ADMIN_PASSWORD` con una contraseña larga.
5. **Mercado Pago:** agrega `MP_ACCESS_TOKEN`. Los avisos de pago se configuran solos. Opcional: en **Tus integraciones → Webhooks** copia la clave secreta a `MP_WEBHOOK_SECRET` para validar la firma.
6. **Stripe:** agrega `STRIPE_SECRET_KEY`. En **Developers → Webhooks → Add endpoint** usa `https://TU-DOMINIO/api/webhooks/stripe` con los eventos `checkout.session.completed` y `checkout.session.async_payment_succeeded`, y copia el *Signing secret* a `STRIPE_WEBHOOK_SECRET`.
7. **Medición:** pon tus IDs en `STORE.analytics` dentro de `js/store.js`:
   - `metaPixelId`: Meta → Administrador de eventos → tu conjunto de datos → ID (solo números).
   - `ga4Id`: Google Analytics → Administrar → Flujos de datos → ID de medición (`G-…`).

   Se registran estos eventos: vista de página, vista de producto (`ViewContent` / `view_item`), agregar al carrito (`AddToCart` / `add_to_cart`), inicio de pago (`InitiateCheckout` / `begin_checkout`) y compra (`Purchase` / `purchase`, una sola vez por pedido).
8. **Prueba todo** con credenciales de prueba (`TEST-…`, `sk_test_…`) y luego cámbialas por las de producción.

Todas las variables están explicadas en `.env.example`.

## Desarrollo local

```bash
npm i -g vercel
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Las pruebas de las funciones de pago se corren con:

```bash
npm test
```

## Pendientes conocidos

- **WhatsApp automático:** hoy los avisos llegan por correo. Para recibirlos por WhatsApp se necesita la API de WhatsApp Business (Meta o Twilio), que cobra por mensaje y requiere aprobar plantillas.
- **Mercado Libre:** el inventario no se sincroniza solo con Mercado Libre. Hay que restar las ventas de Mercado Libre en `/admin`. Se podría automatizar con la API de Mercado Libre.
- **Meta Conversions API:** el Pixel mide desde el navegador. Si muchas personas usan bloqueadores de anuncios, conviene enviar también las compras desde el servidor.
- **Pagos en OXXO con Stripe:** el cliente ve la página de "gracias" al generar su ficha, aunque todavía no haya pagado. El pedido solo se marca como pagado (y te llega el correo) cuando Stripe confirma el pago.
