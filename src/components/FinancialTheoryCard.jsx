import { useId, useState } from "react";
import {
  Info,
  ChevronDown,
  Sigma,
  Lightbulb,
  Calculator,
  GraduationCap,
} from "lucide-react";

/**
 * Fracción con formato matemático (numerador sobre denominador).
 * Uso: <Frac n="Activo corriente" d="Pasivo corriente" />
 */
export function Frac({ n, d }) {
  return (
    <span className="mx-1 inline-flex flex-col items-center align-middle leading-tight">
      <span className="px-1.5 pb-0.5">{n}</span>
      <span className="w-full border-t border-current px-1.5 pt-0.5">{d}</span>
    </span>
  );
}

/** Ecuación completa: «Nombre = expresión». */
export function Eq({ name, children }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-2">
      {name && <span className="font-semibold text-blue-900">{name}</span>}
      {name && <span className="mx-1 text-slate-500">=</span>}
      {children}
    </span>
  );
}

const isEmpty = (v) =>
  v == null ||
  v === "" ||
  v === "N/D" ||
  (typeof v === "number" && !Number.isFinite(v));

/**
 * Tarjeta didáctica desplegable.
 * - definition: ¿qué es? (texto corto y técnico)
 * - formula: string o nodo React (usa <Frac/> y <Eq/> para formato matemático)
 * - interpretation: ¿qué define el resultado?
 * - dynamicExample: valor ya formateado con los datos actuales del usuario
 *   (string, número o nodo). N/D o vacío muestra un aviso de datos insuficientes.
 */
export default function FinancialTheoryCard({
  title,
  definition,
  formula,
  interpretation,
  dynamicExample,
  exampleLabel = "Con tus datos actuales",
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${
        open
          ? "border-blue-200 shadow-md shadow-blue-900/5"
          : "border-slate-200 shadow-sm hover:border-blue-200"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 bg-gradient-to-r from-blue-50/80 to-white px-4 py-3 text-left"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700">
          <Info size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold tracking-wider text-blue-600 uppercase">
            Guía teórica
          </span>
          <span className="block truncate text-[15px] font-semibold text-slate-800">
            {title}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={bodyId} className="space-y-4 px-4 pt-2 pb-4 text-[13.5px]">
          <section>
            <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <GraduationCap size={14} /> ¿Qué es?
            </h4>
            <p className="m-0 leading-relaxed text-slate-700">{definition}</p>
          </section>
          <section>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <Sigma size={14} /> Fórmula
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-serif text-[15px] text-slate-800 italic">
              {formula}
            </div>
          </section>
          <section>
            <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <Lightbulb size={14} /> ¿Qué interpreta?
            </h4>
            <p className="m-0 leading-relaxed text-slate-700">
              {interpretation}
            </p>
          </section>
          {dynamicExample !== undefined && (
            <div
              className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 ${
                isEmpty(dynamicExample)
                  ? "bg-amber-50 text-amber-800"
                  : "bg-emerald-50 text-emerald-900"
              }`}
            >
              <Calculator size={17} className="mt-0.5 shrink-0" />
              <div>
                <span className="block text-[11px] font-semibold tracking-wide uppercase opacity-75">
                  {exampleLabel}
                </span>
                <span className="font-semibold">
                  {isEmpty(dynamicExample)
                    ? "N/D · registra los datos necesarios para ver el cálculo."
                    : dynamicExample}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** Contenedor en cuadrícula para agrupar varias tarjetas en un módulo. */
export function TheoryGuide({ children, title = "Guía teórica del módulo" }) {
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-center gap-2 text-slate-700">
        <GraduationCap size={18} className="text-blue-600" />
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        <span className="text-xs text-slate-400">
          · Despliega cada tarjeta para ver definición, fórmula y lectura
        </span>
      </div>
      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
