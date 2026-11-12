import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  FileSpreadsheet,
  ChartNoAxesCombined,
  Target,
  ArrowLeftRight,
  CalendarRange,
  Wallet,
  Package,
  Menu,
  X,
  ChevronDown,
  Download,
  Upload,
  BookOpen,
  Check,
  Settings2,
  GraduationCap,
  ArrowUpRight,
} from "lucide-react";
import { useFinance, validateData } from "./lib/store";
import { download } from "./lib/format";
import { Panel, Field, Select, Button, Notice } from "./components/UI";
import { ConfiguracionClaveIA } from "./components/InterpretacionIA";
import ExcelExportMenu from "./components/ExcelExportMenu";
import Dashboard from "./modules/Dashboard";
import Statements from "./modules/Statements";
import Ratios from "./modules/Ratios";
import Cvu from "./modules/Cvu";
import CashFlow from "./modules/CashFlow";
import Budget from "./modules/Budget";
import Personal from "./modules/Personal";
import Inventory from "./modules/Inventory";
export const modules = [
  {
    id: "dashboard",
    label: "Panel principal",
    title: "Panel principal",
    icon: LayoutDashboard,
    description: "Una visión integral de tu información financiera.",
  },
  {
    id: "estados",
    label: "Estados financieros",
    title: "Estados financieros",
    icon: FileSpreadsheet,
    description:
      "Organiza tus balances y compara la estructura de cada período.",
  },
  {
    id: "razones",
    label: "Razones y DuPont",
    title: "Razones financieras y DuPont",
    icon: ChartNoAxesCombined,
    description:
      "Comprende la liquidez, eficiencia y rentabilidad de tu empresa.",
  },
  {
    id: "equilibrio",
    label: "Equilibrio y apalancamiento",
    title: "Punto de equilibrio y apalancamiento",
    icon: Target,
    description: "Simula cambios en precio, costos y volumen de ventas.",
  },
  {
    id: "efectivo",
    label: "Flujo de efectivo",
    title: "Estado de flujo de efectivo",
    icon: ArrowLeftRight,
    description: "Identifica de dónde viene el dinero y cómo se utiliza.",
  },
  {
    id: "presupuesto",
    label: "Presupuesto maestro",
    title: "Planeación y presupuesto maestro",
    icon: CalendarRange,
    description:
      "Conecta ventas, compras, gastos y la caja de los próximos meses.",
  },
  {
    id: "personal",
    label: "Presupuesto personal",
    title: "Presupuesto personal",
    icon: Wallet,
    description:
      "Organiza tus ingresos, controla tus gastos y conoce tu ahorro.",
  },
  {
    id: "inventario",
    label: "Control de inventario",
    title: "Control básico de inventario",
    icon: Package,
    description:
      "Da seguimiento a existencias, valor y necesidades de reposición.",
  },
];
const validRoute = () =>
  modules.some((m) => m.id === location.hash.slice(1))
    ? location.hash.slice(1)
    : "dashboard";
export default function App() {
  const { data, update, setData, warning } = useFinance();
  const [route, setRoute] = useState(validRoute),
    [open, setOpen] = useState(false),
    [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false),
    [message, setMessage] = useState("");
  const fileRef = useRef(null),
    dialogRef = useRef(null),
    closeRef = useRef(null);
  const active = modules.find((m) => m.id === route) || modules[0];
  useEffect(() => {
    const change = () => {
      setRoute(validRoute());
      setOpen(false);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title = `${active.title} | Finance Manager`;
  }, [active]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (settings || help) {
      const previous = document.activeElement;
      dialogRef.current?.showModal();
      closeRef.current?.focus();
      return () => {
        dialogRef.current?.close();
        previous?.focus();
      };
    }
  }, [settings, help]);
  const navigate = (id) => {
    location.hash = id;
    setRoute(id);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const exportBackup = () => {
    download(
      "finance-manager-respaldo.json",
      JSON.stringify(data, null, 2),
      "application/json",
    );
    setMessage(
      "Respaldo descargado. Conserva el archivo para recuperar tus datos.",
    );
  };
  const importBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw Error("El respaldo supera el límite de 5 MB.");
      const parsed = validateData(JSON.parse(await file.text()));
      if (
        window.confirm(
          "El respaldo reemplazará los datos actuales. ¿Deseas importarlo?",
        )
      ) {
        setData(parsed);
        setMessage("Respaldo importado correctamente.");
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      e.target.value = "";
    }
  };
  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Saltar al contenido
      </a>
      {open && (
        <button
          className="nav-overlay"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("dashboard")}
          aria-label="Finance Manager, inicio"
        >
          <span className="brand-mark">
            <ChartNoAxesCombined size={25} />
          </span>
          <span>
            Finance<span>Manager</span>
          </span>
        </button>
        <div className="workspace-label">GESTIÓN FINANCIERA OPERATIVA</div>
        <nav aria-label="Navegación principal">
          <span className="nav-heading">GENERAL</span>
          <NavItem m={modules[0]} active={route} navigate={navigate} />
          <span className="nav-heading">ANÁLISIS Y PLANEACIÓN</span>
          {modules.slice(1, 6).map((m) => (
            <NavItem key={m.id} m={m} active={route} navigate={navigate} />
          ))}
          <span className="nav-heading">HERRAMIENTAS PERSONALES</span>
          {modules.slice(6).map((m) => (
            <NavItem key={m.id} m={m} active={route} navigate={navigate} />
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="help-link"
            onClick={() => {
              setHelp(true);
              setOpen(false);
            }}
          >
            <BookOpen size={18} /> Guía y fundamentos <ArrowUpRight size={14} />
          </button>
          <div className="university">
            <img
              className="uni-logo"
              src={`${import.meta.env.BASE_URL}uni-logo.png`}
              alt="Logo de la Universidad Nacional de Ingeniería"
              width="62"
              height="39"
            />
            <div>
              <strong>Proyecto integrador</strong>
              <small>Managua, Nicaragua</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(!open)}
              aria-label="Abrir navegación"
              aria-expanded={open}
            >
              <Menu size={23} />
            </button>
            <span className="desktop-only">Mi espacio</span>
            <span className="desktop-only">/</span>
            <strong>{active.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="saved-status">
              <span />
              {warning
                ? "Guardado local no disponible"
                : "Guardado en este navegador"}
            </span>
            <button
              className="icon-button"
              onClick={() => setSettings(true)}
              aria-label="Configurar empresa y moneda"
            >
              <Settings2 size={19} />
            </button>
            <span className="avatar" title="Proyecto académico">
              FM
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="page-kicker">
                FINANCE MANAGER <span>/</span>{" "}
                {route === "dashboard" ? "VISTA GENERAL" : "ESPACIO DE TRABAJO"}
              </div>
              <h1>{active.title}</h1>
              <p>{active.description}</p>
            </div>
            <div className="page-actions">
              <label className="period-select">
                <CalendarRange size={16} />
                <span className="sr-only">Período seleccionado</span>
                <select
                  aria-label="Período seleccionado"
                  value={data.selected}
                  onChange={(e) =>
                    update((d) => {
                      d.selected = +e.target.value;
                    })
                  }
                >
                  {data.periods.map((p, i) => (
                    <option key={p.id} value={i}>
                      {p.label || `Período ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <ExcelExportMenu route={route} onDone={setMessage} />
              <Button secondary onClick={exportBackup}>
                <Download size={16} />
                <span>Respaldar datos</span>
              </Button>
            </div>
          </div>
          {warning && <Notice tone="warning">{warning}</Notice>}
          {message && (
            <div role="status" className="toast">
              <Check size={18} />
              {message}
              <button
                className="icon-button"
                onClick={() => setMessage("")}
                aria-label="Cerrar aviso"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {route === "dashboard" && (
            <Dashboard navigate={navigate} modules={modules} />
          )}{" "}
          {route === "estados" && <Statements />}
          {route === "razones" && <Ratios />}
          {route === "equilibrio" && <Cvu />}
          {route === "efectivo" && <CashFlow />}
          {route === "presupuesto" && <Budget />}
          {route === "personal" && <Personal />}
          {route === "inventario" && <Inventory />}
          <footer className="footer">
            <span>
              Finance Manager <span>·</span> Gestión Financiera Operativa
            </span>
            <span>Proyecto académico · UNI Nicaragua</span>
          </footer>
        </main>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={importBackup}
      />
      <dialog
        ref={dialogRef}
        className="modal"
        onCancel={() => {
          setSettings(false);
          setHelp(false);
        }}
      >
        <div className="modal-header">
          <h2>{settings ? "Tu espacio financiero" : "Guía y fundamentos"}</h2>
          <button
            ref={closeRef}
            className="icon-button"
            aria-label="Cerrar ventana"
            onClick={() => {
              setSettings(false);
              setHelp(false);
            }}
          >
            <X size={20} />
          </button>
        </div>
        {settings ? (
          <div className="module-stack">
            <Field
              label="Nombre de la empresa"
              type="text"
              value={data.company}
              onChange={(v) =>
                update((d) => {
                  d.company = v;
                })
              }
            />
            <Select
              label="Moneda de los importes empresariales"
              value={data.currency}
              onChange={(v) =>
                update((d) => {
                  d.currency = v;
                })
              }
            >
              <option value="C$">C$ · Córdobas</option>
              <option value="$">$ · Dólares</option>
            </Select>
            <p className="helper">
              Cambiar la moneda modifica la etiqueta, no convierte los importes.
              Mantén una sola moneda en tus registros.
            </p>
            <div className="button-row">
              <Button onClick={exportBackup}>
                <Download size={16} />
                Descargar respaldo
              </Button>
              <Button secondary onClick={() => fileRef.current?.click()}>
                <Upload size={16} />
                Importar respaldo
              </Button>
            </div>
            <Notice>
              Los datos se guardan localmente en este navegador. Descarga un
              respaldo antes de borrar el historial o cambiar de dispositivo. No
              se envían a un servidor.
            </Notice>
            <ConfiguracionClaveIA />
          </div>
        ) : (
          <div className="help-content">
            <img
              className="help-uni-logo"
              src={`${import.meta.env.BASE_URL}uni-logo.png`}
              alt="UNI · Universidad Nacional de Ingeniería"
              width="114"
              height="71"
            />
            <p>
              Este sistema sigue la guía del Proyecto Final GFO 2026 y los
              materiales de clase proporcionados. Empieza vacío: los archivos de
              referencia definen las operaciones, no cargan cifras en tu
              empresa.
            </p>
            <h3>1. Registra los estados</h3>
            <p>
              Agrega períodos en orden cronológico. Captura saldos de cierre,
              ingresos y gastos. Los importes vacíos equivalen a cero; N/D
              señala que no se puede dividir entre cero. Verifica que el balance
              cuadre.
            </p>
            <h3>2. Analiza y simula</h3>
            <p>
              Las razones usan el período seleccionado y el anterior. Actividad
              y DuPont utilizan promedios; liquidez usa saldos finales. Los
              períodos anuales tienen base de 365 días. En C-V-U, registra
              unidades y revisa la clasificación de costos variables y fijos.
            </p>
            <h3>3. Planifica la caja</h3>
            <p>
              El presupuesto puede vincularse al estado o usar supuestos
              manuales. El crédito se liquida al mes siguiente. La depreciación
              reduce la utilidad, pero no la caja. El EFE registra movimientos
              reales, separados de las proyecciones.
            </p>
            <h3>4. Interpreta con IA</h3>
            <p>
              Al final de cada módulo, <strong>Visión con IA</strong> envía solo
              las cifras calculadas a Gemini y devuelve una lectura en Markdown.
              El asistente interpreta, no decide ni recomienda operaciones. La
              primera vez que uses el botón te pedirá la clave; también puedes
              agregarla en{" "}
              <strong>
                Configurar empresa y moneda → Clave API de Gemini para la visión
                de IA
              </strong>
              . Se guarda únicamente en esta sesión del navegador.
            </p>
            <h3>Referencias del proyecto</h3>
            <ul>
              <li>Guía Actualizada Proyecto Final GFO 2026.</li>
              <li>
                Estados Financieros Básicos y Electrónicas: análisis vertical y
                horizontal.
              </li>
              <li>
                Razones Financieras de Liquidez y Actividad; Análisis DuPont.
              </li>
              <li>
                Análisis de apalancamiento y C-V-U; práctica TOR resuelta.
              </li>
              <li>Flujo de Efectivo GFO 2026.</li>
              <li>
                Sesiones 1–3 del presupuesto maestro, Comercial El Progreso.
              </li>
              <li>Presupuesto de Caja 2026, Comercial San Rafael.</li>
            </ul>
            <p className="helper">
              Las tasas de impuesto son supuestos ingresados por el usuario. No
              se calcula una liquidación tributaria. Proyecto académico
              independiente; esta interfaz no representa un sitio oficial de la
              universidad.
            </p>
          </div>
        )}
      </dialog>
    </>
  );
}
function NavItem({ m, active, navigate }) {
  return (
    <button
      className={`nav-item ${active === m.id ? "active" : ""}`}
      onClick={() => navigate(m.id)}
      aria-current={active === m.id ? "page" : undefined}
    >
      <m.icon size={19} />
      <span>{m.label}</span>
      {active === m.id && <span className="nav-dot" />}
    </button>
  );
}
