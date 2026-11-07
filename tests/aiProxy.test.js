import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  validarSolicitud,
  extraerTexto,
} from "../ai-proxy/src/index.js";

const ORIGEN = "https://joselp27.github.io";

const entorno = (extra = {}) => ({
  GEMINI_API_KEY: "clave-de-prueba",
  ALLOWED_ORIGINS: ORIGEN,
  ALLOWED_MODELS: "gemini-3.8-flash",
  ...extra,
});

const cuerpoBase = {
  model: "gemini-3.8-flash",
  systemInstruction: "Eres un analista financiero.",
  contents: "MÓDULO: Razones\nDATOS: {}",
  maxOutputTokens: 2048,
  thinkingLevel: "low",
};

function peticion(cuerpo, headers = {}, metodo = "POST") {
  return new Request("https://proxy.example/", {
    method: metodo,
    headers: { origin: ORIGEN, "content-type": "application/json", ...headers },
    body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined,
  });
}

test("proxy: preflight permite el origen configurado", async () => {
  const res = await worker.fetch(peticion(null, {}, "OPTIONS"), entorno());
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGEN);
  assert.equal(
    res.headers.get("access-control-allow-headers"),
    "content-type, x-proxy-token",
  );
});

test("proxy: rechaza orígenes desconocidos y métodos distintos de POST", async () => {
  const ajeno = await worker.fetch(
    peticion(cuerpoBase, { origin: "https://ejemplo.com" }),
    entorno(),
  );
  assert.equal(ajeno.status, 403);
  assert.equal(ajeno.headers.get("access-control-allow-origin"), "null");

  const metodo = await worker.fetch(peticion(null, {}, "GET"), entorno());
  assert.equal(metodo.status, 405);
});

test("proxy: exige el token cuando está configurado", async (t) => {
  const env = entorno({ PROXY_TOKEN: "secreto" });

  const sinToken = await worker.fetch(peticion(cuerpoBase), env);
  assert.equal(sinToken.status, 401);

  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "ok" }] } }],
      }),
      { status: 200 },
    );
  t.after(() => {
    globalThis.fetch = original;
  });

  const conToken = await worker.fetch(
    peticion(cuerpoBase, { "x-proxy-token": "secreto" }),
    env,
  );
  assert.equal(conToken.status, 200);
});

test("proxy: reenvía una solicitud válida y devuelve solo el texto", async (t) => {
  const original = globalThis.fetch;
  let visto = null;
  globalThis.fetch = async (url, init) => {
    visto = { url, init };
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                { text: "## Diagnóstico\n" },
                { thought: true, text: "razonamiento interno" },
                { text: "Todo en orden." },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  t.after(() => {
    globalThis.fetch = original;
  });

  const res = await worker.fetch(peticion(cuerpoBase), entorno());
  assert.equal(res.status, 200);
  const datos = await res.json();
  assert.equal(datos.text, "## Diagnóstico\nTodo en orden.");
  assert.equal(datos.model, "gemini-3.8-flash");

  assert.match(
    visto.url,
    /\/v1beta\/models\/gemini-3\.8-flash:generateContent/,
  );
  assert.equal(visto.init.headers["x-goog-api-key"], "clave-de-prueba");
  const enviado = JSON.parse(visto.init.body);
  assert.equal(
    enviado.systemInstruction.parts[0].text,
    cuerpoBase.systemInstruction,
  );
  assert.equal(enviado.contents[0].parts[0].text, cuerpoBase.contents);
  assert.equal(enviado.generationConfig.maxOutputTokens, 2048);
  assert.equal(enviado.generationConfig.thinkingConfig.thinkingLevel, "LOW");
});

test("proxy: valida modelo, tamaño y campos obligatorios", () => {
  assert.equal(validarSolicitud(cuerpoBase, entorno()), null);
  assert.match(
    validarSolicitud({ ...cuerpoBase, model: "gemini-3.6-flash" }, entorno()),
    /modelo/,
  );
  assert.match(
    validarSolicitud({ ...cuerpoBase, contents: "" }, entorno()),
    /datos/,
  );
  assert.match(
    validarSolicitud({ ...cuerpoBase, contents: "x".repeat(60001) }, entorno()),
    /grandes/,
  );
  assert.match(
    validarSolicitud({ ...cuerpoBase, maxOutputTokens: 99999 }, entorno()),
    /salida/,
  );
  assert.match(
    validarSolicitud({ ...cuerpoBase, thinkingLevel: "ultra" }, entorno()),
    /razonamiento/,
  );
  assert.match(validarSolicitud(null, entorno()), /objeto/);
});

test("proxy: devuelve 400 si el cuerpo excede el límite o no es JSON", async () => {
  const grande = await worker.fetch(
    peticion({ ...cuerpoBase, contents: "x".repeat(100001) }),
    entorno(),
  );
  assert.equal(grande.status, 413);

  const invalido = await worker.fetch(
    new Request("https://proxy.example/", {
      method: "POST",
      headers: { origin: ORIGEN, "content-type": "application/json" },
      body: "{no es json",
    }),
    entorno(),
  );
  assert.equal(invalido.status, 400);
});

test("proxy: traduce errores de Gemini sin filtrar detalles", async (t) => {
  const original = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: 429,
          message: "projects/123/secrets/... quota exceeded",
          status: "RESOURCE_EXHAUSTED",
        },
      }),
      { status: 429 },
    );
  const limite = await worker.fetch(peticion(cuerpoBase), entorno());
  assert.equal(limite.status, 429);
  const datos = await limite.json();
  assert.match(datos.error, /límite de uso/i);
  assert.ok(!JSON.stringify(datos).includes("projects/"));

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }),
      {
        status: 200,
      },
    );
  const bloqueado = await worker.fetch(peticion(cuerpoBase), entorno());
  assert.equal(bloqueado.status, 400);
  assert.match((await bloqueado.json()).error, /seguridad/i);

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ candidates: [] }), { status: 200 });
  const vacio = await worker.fetch(peticion(cuerpoBase), entorno());
  assert.equal(vacio.status, 502);

  globalThis.fetch = async () => {
    throw new TypeError("falló la red");
  };
  const red = await worker.fetch(peticion(cuerpoBase), entorno());
  assert.equal(red.status, 502);

  globalThis.fetch = original;
  t.after(() => {
    globalThis.fetch = original;
  });
});

test("proxy: falla de forma explícita si falta la clave del Worker", async () => {
  const res = await worker.fetch(
    peticion(cuerpoBase),
    entorno({ GEMINI_API_KEY: "" }),
  );
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /clave de Gemini/i);
});

test("proxy: extraerTexto ignora las partes de razonamiento", () => {
  assert.equal(
    extraerTexto({
      candidates: [
        {
          content: {
            parts: [{ text: "a" }, { thought: true, text: "b" }, { text: "c" }],
          },
        },
      ],
    }),
    "ac",
  );
  assert.equal(extraerTexto({}), "");
});
