import {
  ArrowRight,
  Wallet,
  TrendingUp,
  Landmark,
  Target,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  BookOpen,
} from "lucide-react";
import { useFinance } from "../lib/store";
import {
  statements,
  ratios,
  plan,
  cvu,
  cvuInputs,
  stock,
  num,
} from "../lib/finance";
import { money, percent, times } from "../lib/format";
import { Panel, Metric, Notice, Empty, Button } from "../components/UI";
import { TrendChart } from "../components/Charts";
import InterpretacionIA from "../components/InterpretacionIA";
import { contextoPanel } from "../services/aiContexts";
export default function Dashboard({ navigate, modules }) {
  const { data } = useFinance();
  const p = data.periods[data.selected],
    s = statements(p, data.accounts),
    r = ratios(p, data.periods[data.selected - 1], data.accounts),
    b = plan(data.budget, p, data.accounts),
    c = cvu(cvuInputs(data.cvu, s)),
    mf = (v) => money(v, data.currency);
  const hasData = data.periods.some(
    (x) =>
      Object.values(x.balance).some((v) => v !== "" && v != null) ||
      Object.values(x.income).some((v) => v !== "" && v != null),
  );
  const filledBalance = Object.values(p.balance).some(
      (v) => v !== "" && v != null,
    ),
    filledIncome = Object.values(p.income).some((v) => v !== "" && v != null);
  const chartRows = data.periods.map((x) => ({
    label: x.label,
    ...statements(x, data.accounts),
  }));
  const steps = [
    ["Registra tu balance", filledBalance, "estados"],
    ["Completa ingresos y gastos", filledIncome, "estados"],
    ["Construye tu presupuesto", b.valid, "presupuesto"],
  ];
  return (
    <div className="module-stack">
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">TU ESPACIO DE ANÁLISIS FINANCIERO</span>
          <h2>
            {hasData
              ? "Tus números, conectados."
              : "Una buena decisión empieza con tus datos."}
          </h2>
          <p>
            {hasData
              ? `Consulta los resultados de ${data.company || "tu empresa"} y anticipa los próximos meses.`
              : "Registra tus estados financieros y transforma la información en análisis, escenarios y planes."}
          </p>
          <button onClick={() => navigate("estados")}>
            {hasData
              ? "Editar estados financieros"
              : "Registrar mis primeros datos"}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="art-grid" />
          <div className="art-bars">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <span className="art-arrow">↗</span>
          <span className="art-label">ANÁLISIS + PLANEACIÓN</span>
        </div>
      </section>
      <div className="section-top">
        <h2>Resumen ejecutivo</h2>
        <span className="muted">
          {p.label} · {data.currency === "C$" ? "Córdobas" : "Dólares"}
        </span>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Liquidez corriente"
          icon={Wallet}
          value={hasData ? times(r.current) : "—"}
          detail="Activo corriente / pasivo corriente"
          onClick={() => navigate("razones")}
        />
        <Metric
          label="Rentabilidad del patrimonio"
          icon={TrendingUp}
          value={hasData ? percent(r.roe) : "—"}
          detail={`ROA: ${hasData ? percent(r.roa) : "—"}`}
          onClick={() => navigate("razones")}
        />
        <Metric
          label="Caja proyectada"
          icon={Landmark}
          value={b.valid ? mf(b.rows.at(-1)?.closingCash) : "—"}
          detail={
            b.valid
              ? "Saldo al cierre del plan"
              : "Completa los supuestos del presupuesto"
          }
          onClick={() => navigate("presupuesto")}
        />
        <Metric
          label="Punto de equilibrio"
          icon={Target}
          value={c.breakEvenMoney == null ? "—" : mf(c.breakEvenMoney)}
          detail={
            c.q == null
              ? "Completa precio, costos y volumen"
              : `${Math.ceil(c.q).toLocaleString("en-US")} unidades mínimas`
          }
          onClick={() => navigate("equilibrio")}
        />
      </div>
      <div className="two-columns dashboard-charts">
        <Panel
          title="Evolución de resultados"
          subtitle="Ventas y utilidad neta por período registrado."
          action={
            <button className="text-button" onClick={() => navigate("estados")}>
              Ver análisis <ArrowUpRight size={15} />
            </button>
          }
        >
          {hasData ? (
            <TrendChart rows={chartRows} />
          ) : (
            <Empty
              title="Aquí verás la evolución de tu empresa"
              action={
                <Button secondary onClick={() => navigate("estados")}>
                  Agregar estados <ArrowRight size={15} />
                </Button>
              }
            >
              Al registrar tus períodos, podrás comparar ventas y utilidad en un
              solo lugar.
            </Empty>
          )}
        </Panel>
        <Panel
          title="Tu ruta de trabajo"
          subtitle="Un sistema, una misma información."
        >
          <div className="checklist">
            {steps.map(([label, done, to], i) => (
              <button key={label} onClick={() => navigate(to)}>
                <span className={done ? "check done" : "check"}>
                  {done ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span>
                  <strong>{label}</strong>
                  <small>
                    {done ? "Datos registrados" : "Pendiente de completar"}
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <div className="academic-note">
            <BookOpen size={21} />
            <p>
              <strong>Aprende con cada cálculo</strong>
              <span>
                Encuentra las fórmulas y los criterios de clase dentro de cada
                módulo.
              </span>
            </p>
          </div>
        </Panel>
      </div>
      {hasData && Math.abs(s.difference) > 0.005 && (
        <Notice tone="warning">
          El balance de {p.label} tiene una diferencia de {mf(s.difference)}.
          Revisa las cuentas antes de interpretar las razones.
        </Notice>
      )}
      {data.inventory.some((x) => stock(x).low) && (
        <Notice tone="warning">
          Hay productos por debajo del stock mínimo. Revisa el módulo de
          inventario.
        </Notice>
      )}
      <div className="section-top">
        <div>
          <h2>Explora tus herramientas</h2>
          <p className="muted">Del estado financiero a la decisión.</p>
        </div>
        <span className="section-tag">{modules.length - 1} HERRAMIENTAS</span>
      </div>
      <div className="module-cards">
        {modules
          .filter((m) => m.id !== "dashboard")
          .map((m, i) => (
            <button
              className="module-card"
              key={m.id}
              onClick={() => navigate(m.id)}
            >
              <div className="module-card-top">
                <span className="module-icon">
                  <m.icon size={22} />
                </span>
                <span className="module-number">0{i + 1}</span>
              </div>
              <h3>{m.label}</h3>
              <p>{m.description}</p>
              <span className="module-link">
                Abrir módulo <ArrowUpRight size={16} />
              </span>
            </button>
          ))}
      </div>
      <InterpretacionIA
        modulo="Panel principal"
        obtenerContexto={() =>
          contextoPanel(data, p, data.periods[data.selected - 1])
        }
        habilitado={hasData}
        motivoDeshabilitado="Registra tus estados financieros para generar una interpretación del panel."
      />
    </div>
  );
}
