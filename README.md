# Lonier Skin — tienda en línea

Tienda de Lonier Skin hecha con HTML, CSS y JavaScript, sin frameworks. El cobro se hace con **Mercado Pago** y **Stripe** mediante dos funciones serverless en Vercel.

## Páginas

| Ruta | Archivo | Qué hace |
| --- | --- | --- |
| `/` | `index.html` | Portada: beneficios, cómo usar, opiniones y preguntas frecuentes |
| `/tienda` | `tienda.html` | Catálogo, generado desde `js/store.js` |
| `/producto?id=…` | `producto.html` | Ficha del producto: galería, cantidad, comprar ahora y datos estructurados para Google |
| `/carrito` | `carrito.html` | Carrito, datos de envío y pago con Mercado Pago, Stripe, WhatsApp o Mercado Libre |
| `/gracias` | `gracias.html` | Resultado del pago: aprobado, pendiente (OXXO) o rechazado |
| `/politicas` | `politicas.html` | Envíos, devoluciones, términos y aviso de privacidad (**es una plantilla: hay que completarla**) |

## Cómo está organizado

- `js/store.js`: **el único lugar donde se cambian precios, productos, costo de envío, WhatsApp y el enlace a Mercado Libre.** Lo usan tanto la página como el servidor.
- `js/cart.js`: el carrito. Se guarda en el navegador (`localStorage`), así que no se pierde al recargar.
- `js/layout.js`: encabezado, pie de página, carrito lateral y botón de WhatsApp, compartidos por todas las páginas.
- `api/checkout/mercadopago.js`: crea la preferencia de pago de Mercado Pago (Checkout Pro).
- `api/checkout/stripe.js`: crea la sesión de pago de Stripe Checkout.
- `api/_lib/order.js`: valida el pedido y **calcula el total en el servidor con los precios del catálogo**. El navegador solo envía qué productos y cuántos, así que nadie puede cambiar el precio desde el navegador.

## Cambios habituales

- **Precio o descuento:** cambia `price` y `compareAtPrice` en `js/store.js`. Para quitar el precio tachado, borra `compareAtPrice`.
- **Envío:** cambia `STORE.shipping.fee`. Para dar envío gratis a partir de cierto monto, pon por ejemplo `freeOver: 599`.
- **Botón de Mercado Libre:** pega el enlace de tu publicación en `STORE.mercadoLibreUrl`.
- **Agregar un producto:** agrega otro objeto a `PRODUCTS` y sus fotos a `assets/`.
- **Fotos:** sube `assets/serum-front.png` y `assets/serum-single.png`. Mientras no existan, se muestra la imagen de reemplazo `assets/serum-placeholder.svg`.

## Publicar en Vercel

1. Importa el repositorio en [vercel.com](https://vercel.com/new). No hace falta ningún paso de build.
2. En **Settings → Environment Variables** agrega las variables de `.env.example`:
   - `MP_ACCESS_TOKEN`: en Mercado Pago, **Tus integraciones → Credenciales**.
   - `STRIPE_SECRET_KEY`: en Stripe, **Developers → API keys**.
   - `SITE_URL`: tu dominio, por ejemplo `https://www.tudominio.com`.
3. Primero usa credenciales **de prueba** (`TEST-…` y `sk_test_…`) y haz compras de prueba. Cuando todo funcione, cámbialas por las de producción.
4. En Stripe, activa en **Settings → Payment methods** los métodos que quieras aceptar (tarjeta, OXXO, etc.).

Si falta una de las llaves, ese botón de pago muestra un aviso y el cliente puede pedir por WhatsApp.

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

- **Avisos de pago (webhooks):** por ahora, para confirmar un pago revisa tu panel de Mercado Pago o Stripe; los dos te mandan un correo por cada venta. El siguiente paso sería recibir los avisos de pago automáticos y guardar los pedidos en una base de datos o mandarlos a tu WhatsApp o correo.
- **Inventario:** no se controla el stock. Si vendes también en Mercado Libre, cuida no vender piezas que ya no tengas.
