// El modelo se puede cambiar sin tocar el código con VITE_GEMINI_MODEL.
export const MODELO_IA =
  (import.meta.env.VITE_GEMINI_MODEL || "").trim() || "gemini-3.8-flash";

// Modo recomendado para el sitio publicado: un proxy propio guarda la clave.
const PROXY_URL_CRUDO = (import.meta.env.VITE_AI_PROXY_URL || "").trim();
const PROXY_URL = /^https?:\/\//i.test(PROXY_URL_CRUDO)
  ? PROXY_URL_CRUDO.replace(/\/+$/, "")
  : "";
const PROXY_TOKEN = (import.meta.env.VITE_AI_PROXY_TOKEN || "").trim();
const TIEMPO_MAX_PROXY = 75000;

const CLAVE_SESION = "finance-manager-gemini-key";
const CLAVE_ENTORNO = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();

let cliente = null;
let clienteConClave = "";

export function usaProxyIA() {
  return Boolean(PROXY_URL);
}

export function claveDesdeEntorno() {
  return Boolean(CLAVE_ENTORNO);
}

export function obtenerClaveIA() {
  if (CLAVE_ENTORNO) return CLAVE_ENTORNO;
  try {
    return (sessionStorage.getItem(CLAVE_SESION) || "").trim();
  } catch {
    return "";
  }
}

export function tieneClaveIA() {
  return usaProxyIA() || Boolean(obtenerClaveIA());
}

export function guardarClaveIA(clave) {
  const limpia = String(clave || "").trim();
  if (!limpia) throw Error("La clave está vacía.");
  if (limpia.length > 400) throw Error("La clave no tiene un formato válido.");
  try {
    sessionStorage.setItem(CLAVE_SESION, limpia);
  } catch {
    throw Error(
      "El navegador bloqueó el almacenamiento de la sesión. Usa una ventana normal o define VITE_GEMINI_API_KEY.",
    );
  }
  cliente = null;
  clienteConClave = "";
}

export function borrarClaveIA() {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    // Sin almacenamiento disponible no hay nada que borrar.
  }
  cliente = null;
  clienteConClave = "";
}

async function obtenerCliente() {
  const clave = obtenerClaveIA();
  if (!clave) return null;
  if (!cliente || clienteConClave !== clave) {
    // Carga diferida: el SDK de Gemini no pesa en el arranque de la app.
    const { GoogleGenAI } = await import("@google/genai");
    // Si la clave cambió mientras cargaba el SDK, no reutilices el cliente.
    if (obtenerClaveIA() !== clave) return null;
    cliente = new GoogleGenAI({ apiKey: clave });
    clienteConClave = clave;
  }
  return cliente;
}

export const PROMPT_SISTEMA = `
Eres un analista financiero y docente de Gestión Financiera Operativa (IS2122) de la Universidad Nacional de Ingeniería (UNI), Nicaragua.

TU ÚNICA TAREA ES INTERPRETAR LOS RESULTADOS QUE RECIBES.
No tomas decisiones, no emites órdenes, no recomiendas comprar, vender, endeudarse ni invertir.
No das asesoría legal, tributaria ni de inversión. Eres apoyo académico para comprender cifras.

REGLAS OBLIGATORIAS:
1. Usa exclusivamente las cifras del JSON entregado. Nunca inventes ni estimes un dato que no esté.
2. Si un dato falta, es "N/D" o es insuficiente, dilo explícitamente en la sección de límites.
3. Cada afirmación numérica debe indicar el período y la métrica de la que sale.
4. Distingue entre hecho (la cifra) e interpretación (qué sugiere).
5. No repitas el JSON ni listes todas las cuentas: interpreta lo relevante.
6. Respeta la moneda indicada (C$ o $). No hagas conversión cambiaria.
7. Usa los promedios y la base de días que aparezcan en los datos; no los recalcules con otro criterio.
8. Cuando menciones una herramienta del curso, hazlo solo si los datos la sustentan (Bartlett para razones y promedios, TOR para C-V-U y apalancamiento, San Rafael para caja). No atribuyas cifras al caso si no aparecen.
9. No uses lenguaje imperativo ("debe hacer", "compre", "reduzca"). Usa lenguaje interpretativo ("los datos muestran", "esto sugiere", "conviene revisar").
10. Máximo 450 palabras. Español claro, técnico y directo.

FORMATO DE SALIDA (Markdown):
## 📌 Diagnóstico rápido
Dos o tres oraciones con el hallazgo principal y la cifra que lo respalda.

## 📊 Interpretación técnica
Analiza únicamente las dimensiones presentes en el módulo: liquidez, actividad, endeudamiento, rentabilidad, DuPont, C-V-U, flujo de efectivo, presupuesto, ahorro o inventario. Explica relaciones entre indicadores, no solo valores aislados.

## ⚠️ Riesgos y oportunidades
Observaciones sustentadas en los datos. Sin órdenes ni decisiones. Puedes señalar tensiones, holguras, alertas o datos que cambian la lectura.

## 🔎 Límites del análisis y datos faltantes
Qué no se puede concluir con la información disponible y qué dato adicional cambiaría la interpretación.

## 📚 Lectura desde el curso
Una o dos oraciones que conecten el resultado con el criterio académico aplicable, sin inventar cifras.

Al final, agrega en cursiva:
*Interpretación generada con IA a partir de los datos registrados. No constituye asesoría financiera ni una decisión; verifica los cálculos en los módulos.*
`;

function mensajeDeError(error) {
  const texto = String(error?.message || error || "");
  const estado = Number(error?.status || error?.code || 0);

  if (
    /API key|API_KEY|unauthorized|permission|401|403/i.test(texto) ||
    estado === 401 ||
    estado === 403
  )
    return "La clave de Gemini no es válida o no tiene permisos para este modelo. Revísala en Configuración → Asistente de IA.";
  if (/not found|404|model/i.test(texto) && /model|404|not found/i.test(texto))
    return `El modelo "${MODELO_IA}" no está disponible para esta clave. Puedes cambiarlo con VITE_GEMINI_MODEL.`;
  if (/quota|429|rate limit|resource exhausted/i.test(texto) || estado === 429)
    return "Se alcanzó el límite de uso de Gemini. Espera un momento o revisa la cuota de la clave.";
  if (/fetch|network|failed to fetch|timeout|ENOTFOUND/i.test(texto))
    return "No se pudo conectar con Gemini. Revisa tu conexión a internet e inténtalo de nuevo.";
  if (/400|invalid|bad request/i.test(texto))
    return "Gemini rechazó la solicitud. Verifica que la clave corresponda a la API de Gemini y vuelve a intentarlo.";

  return "No se pudo obtener la interpretación en este momento. Inténtalo de nuevo en unos segundos.";
}

function mensajeDeProxy(estado, datos) {
  if (estado === 401 || estado === 403)
    return "El proxy de IA rechazó la solicitud. Verifica la URL, el token y los orígenes permitidos; si persiste, revisa la clave guardada en el servicio.";
  if (estado === 429)
    return "Se alcanzó el límite de uso del asistente. Espera un momento o revisa la cuota de Gemini.";
  if (estado === 404)
    return `El modelo "${MODELO_IA}" no está disponible en el proxy. Revisa ALLOWED_MODELS en el servicio.`;
  if (estado === 413)
    return "Los datos de este módulo son demasiado grandes para el proxy de IA.";
  if (estado === 400)
    return typeof datos?.error === "string"
      ? datos.error
      : "El proxy de IA rechazó los datos enviados.";
  if (estado >= 500)
    return "El proxy de IA no pudo conectar con Gemini. Inténtalo de nuevo en unos segundos.";

  return "No se pudo obtener la interpretación a través del proxy de IA.";
}

async function solicitarPorProxy(contenido) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAX_PROXY);
  let respuesta;

  try {
    respuesta = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(PROXY_TOKEN ? { "x-proxy-token": PROXY_TOKEN } : {}),
      },
      body: JSON.stringify({
        model: MODELO_IA,
        systemInstruction: PROMPT_SISTEMA,
        contents: contenido,
        maxOutputTokens: 2048,
        thinkingLevel: "low",
      }),
      signal: controlador.signal,
    });
  } catch (error) {
    const limpio = Error(
      error?.name === "AbortError"
        ? "El proxy de IA tardó demasiado en responder. Inténtalo de nuevo."
        : "No se pudo conectar con el proxy de IA. Revisa tu conexión o la URL configurada.",
    );
    limpio.code = "ERROR_IA";
    throw limpio;
  } finally {
    clearTimeout(temporizador);
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const limpio = Error(mensajeDeProxy(respuesta.status, datos));
    limpio.code = "ERROR_IA";
    limpio.status = respuesta.status;
    throw limpio;
  }

  const texto = String(datos?.text || "").trim();
  if (!texto) {
    const limpio = Error(
      "El proxy de IA devolvió una respuesta vacía. Inténtalo de nuevo.",
    );
    limpio.code = "ERROR_IA";
    throw limpio;
  }

  return texto;
}

export async function solicitarAnalisisIA(moduloNombre, datosContexto) {
  const contenido = [
    `MÓDULO: ${moduloNombre}`,
    `MODELO: ${MODELO_IA}`,
    "DATOS PARA INTERPRETAR (JSON):",
    JSON.stringify(datosContexto, null, 2),
  ].join("\n");

  if (usaProxyIA()) return solicitarPorProxy(contenido);

  const ai = await obtenerCliente();
  if (!ai) {
    const error = Error(
      "Falta la clave de Gemini. Agrégala en Configuración → Asistente de IA.",
    );
    error.code = "SIN_CLAVE";
    throw error;
  }

  try {
    const response = await ai.models.generateContent({
      model: MODELO_IA,
      contents: contenido,
      config: {
        systemInstruction: PROMPT_SISTEMA,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: "low" },
      },
    });

    const texto = response?.text?.trim();
    if (!texto)
      throw Error("Gemini devolvió una respuesta vacía. Inténtalo de nuevo.");

    return texto;
  } catch (error) {
    if (error?.code === "SIN_CLAVE") throw error;
    // No registres la clave ni el objeto completo del error.
    console.error("Error al consultar Gemini:", {
      modelo: MODELO_IA,
      mensaje: error?.message,
      estado: error?.status,
    });
    const limpio = Error(mensajeDeError(error));
    limpio.code = "ERROR_IA";
    throw limpio;
  }
}
