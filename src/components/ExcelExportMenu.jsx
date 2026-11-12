import { useEffect, useRef, useState } from "react";
import {
  FileSpreadsheet,
  ChevronDown,
  Loader2,
  BookOpenCheck,
  Layers,
} from "lucide-react";
import { useFinance } from "../lib/store";

// El servicio (y exceljs) se cargan solo al exportar.
const SECTION_SHEETS = {
  estados: "Estados financieros + Análisis V-H",
  razones: "Estados financieros + Razones",
  equilibrio: "Estados financieros + C-V-U",
  efectivo: "Estados financieros + Flujo de efectivo",
  presupuesto: "Estados financieros + Caja",
};

export default function ExcelExportMenu({ route, onDone }) {
  const { data } = useFinance();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const run = async (section) => {
    setOpen(false);
    setBusy(true);
    try {
      const { exportToExcel } =
        await import("../services/exportToExcelService");
      const name = await exportToExcel(data, section);
      onDone?.(
        `Excel generado: ${name}. Las celdas azules son editables y el resto se recalcula con fórmulas.`,
      );
    } catch (err) {
      console.error(err);
      onDone?.("No se pudo generar el archivo de Excel. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  const option = (section, icon, title, detail) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => run(section)}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none"
    >
      <span className="mt-0.5 text-blue-600">{icon}</span>
      <span>
        <span className="block text-[13.5px] font-semibold text-slate-800">
          {title}
        </span>
        <span className="block text-xs text-slate-500">{detail}</span>
      </span>
    </button>
  );
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <FileSpreadsheet size={16} />
        )}
        <span>{busy ? "Generando…" : "Exportar Excel"}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-32px)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          {SECTION_SHEETS[route] &&
            option(
              route,
              <Layers size={17} />,
              "Solo este apartado",
              SECTION_SHEETS[route],
            )}
          {option(
            "completo",
            <BookOpenCheck size={17} />,
            "Libro completo (.xlsx)",
            "6 hojas vinculadas: Estados, Análisis V-H, Razones, C-V-U, Flujo y Caja",
          )}
          <p className="m-0 border-t border-slate-100 px-3 pt-2 pb-1 text-[11px] leading-snug text-slate-500">
            Incluye fórmulas nativas: cambia un dato en «Estados Financieros» y
            Excel recalcula las demás hojas.
          </p>
        </div>
      )}
    </div>
  );
}
