// Proxy mínimo para la API de Gemini.
//
// La clave vive como secreto del Worker (GEMINI_API_KEY) y nunca llega al
// navegador. El Worker solo acepta peticiones del origen permitido, con un
// contrato fijo y límites de tamaño para reducir el abuso.
//
// Despliegue:
//   npx wrangler secret put GEMINI_API_KEY
//   npx wrangler deploy

const MODELO_POR_DEFECTO = "gemini-3.8-flash";
const ORIGEN_POR_DEFECTO = "https://joselp27.github.io";
const LIMITE_CUERPO = 100000;
const LIMITE_CONTENIDO = 60000;
const LIMITE_SISTEMA = 8000;
const LIMITE_SALIDA = 4096;
const NIVELES_PENSAMIENTO = ["MINIMAL", "LOW", "MEDIUM", "HIGH"];

function lista(valor, respaldo) {
  const texto = String(valor || "").trim();
  const base = texto ? texto.split(",") : [respaldo];
  return base.map((item) => item.trim().replace(/\/+$/, "")).filter(Boolean);
}

function origenes(env) {
  return lista(env.ALLOWED_ORIGINS, ORIGEN_POR_DEFECTO);
}

function modelos(env) {
  return lista(env.ALLOWED_MODELS, MODELO_POR_DEFECTO);
}

function cabecerasCors(origin, env) {
  const permitido = origenes(env).includes(origin);
  return {
    "access-control-allow-origin": permitido ? origin : "null",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-proxy-token",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(datos, estado, origin, env) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cabecerasCors(origin, env),
    },
  });
}

export function validarSolicitud(cuerpo, env) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo))
    return "El cuerpo debe ser un objeto JSON.";

  const { model, systemInstruction, contents, maxOutputTokens, thinkingLevel } =
    cuerpo;

  if (model != null && !modelos(env).includes(String(model)))
    return "El modelo solicitado no está permitido en este proxy.";
  if (typeof systemInstruction !== "string" || !systemInstruction.trim())
    return "Falta el prompt de sistema.";
  if (systemInstruction.length > LIMITE_SISTEMA)
    return "El prompt de sistema es demasiado largo.";
  if (typeof contents !== "string" || !contents.trim())
    return "Faltan los datos del módulo.";
  if (contents.length > LIMITE_CONTENIDO)
    return "Los datos del módulo son demasiado grandes.";
  if (
    maxOutputTokens != null &&
    (!Number.isInteger(maxOutputTokens) ||
      maxOutputTokens < 1 ||
      maxOutputTokens > LIMITE_SALIDA)
  )
    return "El límite de salida no es válido.";
  if (
    thinkingLevel != null &&
    !NIVELES_PENSAMIENTO.includes(String(thinkingLevel).toUpperCase())
  )
    return "El nivel de razonamiento no es válido.";

  return null;
}

export function extraerTexto(datos) {
  const partes = datos?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(partes)) return "";
  return partes
    .filter((parte) => parte && parte.thought !== true && parte.text)
    .map((parte) => String(parte.text))
    .join("")
    .trim();
}

function estadoGemini(estado) {
  if ([400, 401, 403, 404, 429].includes(estado)) return estado;
  return 502;
}

function mensajeGemini(estado) {
  if (estado === 400) return "Gemini rechazó la solicitud.";
  if (estado === 401 || estado === 403)
    return "La clave del proxy no es válida o no tiene permisos.";
  if (estado === 404) return "El modelo configurado no está disponible.";
  if (estado === 429) return "Se alcanzó el límite de uso de Gemini.";
  return "No se pudo obtener la interpretación del servicio de IA.";
}

async function interpretar(cuerpo, env, origin) {
  const modelo = String(cuerpo.model || MODELO_POR_DEFECTO);
  const version = String(env.GEMINI_API_VERSION || "v1beta").replace(
    /^\/+|\/+$/g,
    "",
  );
  const url = `https://generativelanguage.googleapis.com/${version}/models/${modelo}:generateContent`;
  const nivel = String(cuerpo.thinkingLevel || "LOW").toUpperCase();
  const salida = Math.min(
    Number.isInteger(cuerpo.maxOutputTokens) ? cuerpo.maxOutputTokens : 2048,
    LIMITE_SALIDA,
  );

  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: cuerpo.systemInstruction }],
        },
        contents: [{ role: "user", parts: [{ text: cuerpo.contents }] }],
        generationConfig: {
          maxOutputTokens: salida,
          thinkingConfig: { thinkingLevel: nivel },
        },
      }),
    });
  } catch {
    return json(
      { error: "No se pudo conectar con Gemini desde el proxy." },
      502,
      origin,
      env,
    );
  }

  if (!respuesta.ok) {
    // El cuerpo de error de Google puede incluir metadatos del proyecto:
    // no se reenvía al navegador.
    console.error("Gemini respondió con error", respuesta.status);
    return json(
      { error: mensajeGemini(respuesta.status) },
      estadoGemini(respuesta.status),
      origin,
      env,
    );
  }

  const datos = await respuesta.json().catch(() => null);
  if (datos?.promptFeedback?.blockReason) {
    return json(
      { error: "Gemini bloqueó la solicitud por sus filtros de seguridad." },
      400,
      origin,
      env,
    );
  }

  const texto = extraerTexto(datos);
  if (!texto) {
    return json(
      { error: "Gemini no devolvió contenido. Inténtalo de nuevo." },
      502,
      origin,
      env,
    );
  }

  return json({ text: texto, model: modelo }, 200, origin, env);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";

    if (request.method === "OPTIONS") {
      if (!origenes(env).includes(origin))
        return json({ error: "Origen no permitido." }, 403, origin, env);
      return new Response(null, {
        status: 204,
        headers: cabecerasCors(origin, env),
      });
    }

    if (request.method !== "POST")
      return json({ error: "Método no permitido." }, 405, origin, env);

    if (!origenes(env).includes(origin))
      return json({ error: "Origen no permitido." }, 403, origin, env);

    if (env.PROXY_TOKEN) {
      const token = request.headers.get("x-proxy-token") || "";
      if (token !== env.PROXY_TOKEN)
        return json({ error: "Token del proxy inválido." }, 401, origin, env);
    }

    if (!env.GEMINI_API_KEY) {
      console.error("Falta el secreto GEMINI_API_KEY en el Worker");
      return json(
        { error: "El proxy no tiene configurada la clave de Gemini." },
        500,
        origin,
        env,
      );
    }

    const crudo = await request.text();
    if (crudo.length > LIMITE_CUERPO)
      return json(
        { error: "La solicitud es demasiado grande." },
        413,
        origin,
        env,
      );

    let cuerpo;
    try {
      cuerpo = JSON.parse(crudo);
    } catch {
      return json({ error: "El cuerpo no es JSON válido." }, 400, origin, env);
    }

    const problema = validarSolicitud(cuerpo, env);
    if (problema) return json({ error: problema }, 400, origin, env);

    return interpretar(cuerpo, env, origin);
  },
};
