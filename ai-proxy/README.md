# Proxy de IA (Cloudflare Worker)

Este Worker recibe la solicitud del navegador, agrega la clave de Gemini y llama a la API. **La clave nunca se incluye en el sitio publicado.**

## Requisitos

- Cuenta gratuita de Cloudflare.
- Node.js 20 o superior.

## Despliegue

Desde la carpeta `ai-proxy`:

```sh
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

`wrangler deploy` imprime una URL parecida a:

```text
https://finance-manager-ai.TU-SUBDOMINIO.workers.dev
```

Copia esa URL y agrégala en GitHub:

1. Repositorio → **Settings** → **Secrets and variables** → **Actions**.
2. Pestaña **Variables** → **New repository variable**.
3. Nombre: `AI_PROXY_URL`. Valor: la URL del Worker.
4. Opcional: crea el secreto `PROXY_TOKEN` en el Worker (`npx wrangler secret put PROXY_TOKEN`) y la variable `AI_PROXY_TOKEN` en GitHub con el mismo valor.

El workflow de GitHub Pages lee `AI_PROXY_URL` y compila la app con `VITE_AI_PROXY_URL`. No agregues `VITE_GEMINI_API_KEY` en GitHub.

## Desarrollo local

Crea `ai-proxy/.dev.vars` (ignorado por Git):

```sh
GEMINI_API_KEY=tu_clave
```

Ejecuta:

```sh
npx wrangler dev
```

Y en `Finance Manager website/.env.local`:

```sh
VITE_AI_PROXY_URL=http://127.0.0.1:8787
VITE_GEMINI_MODEL=gemini-3.8-flash
```

## Contrato

`POST /` con JSON:

```json
{
  "model": "gemini-3.8-flash",
  "systemInstruction": "prompt del sistema",
  "contents": "datos del módulo",
  "maxOutputTokens": 2048,
  "thinkingLevel": "low"
}
```

Respuesta correcta:

```json
{ "text": "interpretación en Markdown", "model": "gemini-3.8-flash" }
```

Errores: `{ "error": "mensaje en español" }` con estado HTTP 400, 401, 403, 404, 413, 429 o 5xx.

## Seguridad

- La clave se guarda como secreto del Worker y no se envía al cliente.
- `ALLOWED_ORIGINS` limita qué páginas pueden llamar al Worker desde un navegador.
- `PROXY_TOKEN` es una barrera adicional, pero al viajar en el bundle no es un secreto real.
- CORS no impide llamadas fuera del navegador. Configura un límite de gasto y de cuota en Google AI Studio, y considera una regla de rate limiting en Cloudflare.
- Rota la clave si alguna vez se publicó o se compartió por chat.
