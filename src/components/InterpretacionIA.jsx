import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  X,
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, Field, Notice } from "./UI";
import {
  MODELO_IA,
  claveDesdeEntorno,
  guardarClaveIA,
  borrarClaveIA,
  tieneClaveIA,
  usaProxyIA,
  solicitarAnalisisIA,
} from "../services/aiService";

function FormularioClave({ onGuardada, onCancelar }) {
  const [clave, setClave] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");

  const guardar = () => {
    try {
      guardarClaveIA(clave);
      setClave("");
      setError("");
      onGuardada?.();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="ai-key-form">
      <div className="ai-key-icon">
        <KeyRound size={22} />
      </div>
      <h3>Falta la clave de Gemini</h3>
      <p>
        El asistente necesita una clave de la API de Gemini para interpretar los
        resultados. Se guarda solo en esta sesión del navegador y no se envía a
        ningún servidor propio.
      </p>
      <Field
        label="Clave de API de Gemini"
        type={visible ? "text" : "password"}
        value={clave}
        onChange={setClave}
        disabled={false}
      />
      <div className="button-row">
        <Button onClick={guardar} disabled={!clave.trim()}>
          <ShieldCheck size={16} /> Guardar y analizar
        </Button>
        <Button secondary onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          {visible ? "Ocultar" : "Mostrar"}
        </Button>
        {onCancelar && (
          <Button secondary onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </div>
      {error && <p className="ai-error-text">{error}</p>}
      <p className="ai-helper">
        También puedes definir <code>VITE_GEMINI_API_KEY</code> en un archivo{" "}
        <code>.env.local</code> antes de ejecutar la app. No publiques la clave
        en GitHub Pages.
      </p>
    </div>
  );
}

export function ConfiguracionClaveIA({ onGuardada }) {
  const [clave, setClave] = useState("");
  const [visible, setVisible] = useState(false);
  const [configurada, setConfigurada] = useState(() => tieneClaveIA());
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  if (usaProxyIA()) {
    return (
      <div className="ai-key-config">
        <h3>Asistente de IA</h3>
        <Notice>
          El asistente usa un <strong>proxy seguro</strong>. La clave de Gemini
          vive en el servidor del proxy y no se incluye en esta página, así que
          no necesitas ingresar una clave en este navegador.
        </Notice>
        <p className="ai-helper">
          Modelo: <strong>{MODELO_IA}</strong>. Si el proxy deja de responder,
          revisa su implementación y la variable <code>AI_PROXY_URL</code> del
          repositorio.
        </p>
      </div>
    );
  }

  if (claveDesdeEntorno()) {
    return (
      <div className="ai-key-config">
        <h3>Asistente de IA</h3>
        <Notice>
          La clave se está leyendo de <code>VITE_GEMINI_API_KEY</code>. El
          modelo configurado es <strong>{MODELO_IA}</strong>.
        </Notice>
        <p className="ai-helper">
          Ojo: las variables <code>VITE_</code> quedan visibles en el paquete
          publicado. Para un sitio público, usa una clave restringida o un
          proxy.
        </p>
      </div>
    );
  }

  const guardar = () => {
    try {
      guardarClaveIA(clave);
      setClave("");
      setConfigurada(true);
      setMensaje("Clave guardada solo para esta sesión del navegador.");
      setError("");
      onGuardada?.();
    } catch (e) {
      setError(e.message);
    }
  };

  const borrar = () => {
    borrarClaveIA();
    setConfigurada(false);
    setMensaje("Clave eliminada de esta sesión.");
    setError("");
  };

  return (
    <div className="ai-key-config">
      <h3>Asistente de IA</h3>
      <p className="ai-helper">
        Modelo: <strong>{MODELO_IA}</strong>. La clave se guarda en{" "}
        <code>sessionStorage</code>: desaparece al cerrar esta pestaña y no se
        incluye en los respaldos JSON.
      </p>
      <Field
        label="Clave de API de Gemini"
        type={visible ? "text" : "password"}
        value={clave}
        onChange={setClave}
      />
      <div className="button-row">
        <Button onClick={guardar} disabled={!clave.trim()}>
          <ShieldCheck size={16} /> Guardar en esta sesión
        </Button>
        <Button secondary onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          {visible ? "Ocultar" : "Mostrar"}
        </Button>
        {configurada && (
          <Button secondary onClick={borrar}>
            Borrar clave
          </Button>
        )}
      </div>
      {configurada && !mensaje && (
        <p className="ai-ok-text">Hay una clave configurada en esta sesión.</p>
      )}
      {mensaje && <p className="ai-ok-text">{mensaje}</p>}
      {error && <p className="ai-error-text">{error}</p>}
    </div>
  );
}

export default function InterpretacionIA({
  modulo,
  obtenerContexto,
  habilitado = true,
  motivoDeshabilitado = "Registra datos en este módulo para generar una interpretación.",
}) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const dialogRef = useRef(null);
  const peticionRef = useRef(0);
  const viaProxy = usaProxyIA();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (abierto && !dialog.open) dialog.showModal();
    if (!abierto && dialog.open) dialog.close();
  }, [abierto]);

  useEffect(
    () => () => {
      peticionRef.current += 1;
    },
    [],
  );

  // React reutiliza este componente al cambiar de módulo: limpia el estado
  // para no mostrar el resultado o la carga del módulo anterior.
  useEffect(() => {
    peticionRef.current += 1;
    setAbierto(false);
    setCargando(false);
    setResultado("");
    setError("");
    setCopiado(false);
  }, [modulo]);

  const analizar = async () => {
    if (!tieneClaveIA()) return;
    const id = ++peticionRef.current;
    setCargando(true);
    setError("");
    setResultado("");
    try {
      const contexto = obtenerContexto();
      const texto = await solicitarAnalisisIA(modulo, contexto);
      if (id !== peticionRef.current) return;
      setResultado(texto);
    } catch (e) {
      if (id !== peticionRef.current) return;
      setError(e.message);
    } finally {
      if (id === peticionRef.current) setCargando(false);
    }
  };

  const abrir = () => {
    setAbierto(true);
    setError("");
    if (tieneClaveIA() && !resultado && !cargando) analizar();
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resultado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  };

  return (
    <>
      <section className="ai-card" aria-labelledby={`ai-title-${modulo}`}>
        <div className="ai-card-copy">
          <span className="ai-kicker">
            <Sparkles size={15} /> ASISTENTE DE IA
          </span>
          <h3 id={`ai-title-${modulo}`}>Interpretación de IA</h3>
          <p>
            Analiza los resultados de este módulo y explica qué sugieren. No
            toma decisiones ni sustituye tu criterio.
          </p>
          <span className="ai-model-chip">
            {MODELO_IA}
            {viaProxy ? " · proxy seguro" : ""}
          </span>
        </div>
        <span
          className="ai-trigger-wrap"
          title={habilitado ? `Analizar ${modulo}` : motivoDeshabilitado}
        >
          <Button
            onClick={abrir}
            disabled={!habilitado || cargando}
            aria-describedby={`ai-help-${modulo}`}
          >
            <Sparkles size={16} />
            {cargando ? "Analizando..." : "Interpretación de IA"}
          </Button>
        </span>
        <small id={`ai-help-${modulo}`} className="ai-disabled-note">
          {habilitado
            ? "Solo interpretación: no emite decisiones financieras."
            : motivoDeshabilitado}
        </small>
      </section>

      <dialog
        ref={dialogRef}
        className="modal ai-modal"
        onCancel={() => setAbierto(false)}
        onClose={() => setAbierto(false)}
        aria-labelledby="ai-modal-title"
      >
        <div className="modal-header">
          <div>
            <span className="ai-kicker">
              <Sparkles size={15} /> {MODELO_IA}
              {viaProxy ? " · proxy" : ""}
            </span>
            <h2 id="ai-modal-title">Interpretación financiera con IA</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar interpretación"
            onClick={() => setAbierto(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="ai-modal-body">
          {!tieneClaveIA() ? (
            <FormularioClave
              onGuardada={analizar}
              onCancelar={() => setAbierto(false)}
            />
          ) : cargando ? (
            <div className="ai-loading" role="status" aria-live="polite">
              <span className="ai-spinner" aria-hidden="true" />
              <h3>Analizando el módulo de {modulo.toLowerCase()}...</h3>
              <p>
                {MODELO_IA} está evaluando la posición financiera. Esto puede
                tardar unos segundos.
              </p>
            </div>
          ) : error ? (
            <div className="ai-error">
              <Notice tone="warning">{error}</Notice>
              {!viaProxy && error.includes("clave") && (
                <FormularioClave onGuardada={analizar} />
              )}
              <div className="button-row">
                <Button secondary onClick={analizar}>
                  <RefreshCw size={16} /> Reintentar
                </Button>
              </div>
            </div>
          ) : resultado ? (
            <div className="ai-markdown">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noreferrer" />
                  ),
                }}
              >
                {resultado}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="ai-empty">
              <Sparkles size={26} />
              <h3>Listo para interpretar</h3>
              <p>
                Se enviarán las cifras ya calculadas de {modulo} a {MODELO_IA}.
                No se envía tu respaldo completo.
              </p>
              <Button onClick={analizar}>
                <Sparkles size={16} /> Generar interpretación
              </Button>
            </div>
          )}
        </div>

        <div className="ai-modal-footer">
          <span className="ai-disclaimer">
            Generado con IA a partir de los datos registrados. No es asesoría
            financiera ni una decisión.
          </span>
          <div className="button-row">
            {resultado && !cargando && (
              <>
                <Button secondary onClick={copiar}>
                  {copiado ? <Check size={16} /> : <Copy size={16} />}
                  {copiado ? "Copiado" : "Copiar"}
                </Button>
                <Button secondary onClick={analizar}>
                  <RefreshCw size={16} /> Regenerar
                </Button>
              </>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
