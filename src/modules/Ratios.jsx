import { useFinance } from "../lib/store";
import { ratios, statements } from "../lib/finance";
import { money, number, percent, times } from "../lib/format";
import { Panel, Notice, Table, Metric, Export } from "../components/UI";
import { RatiosTheory } from "../content/theoryGuides";
import InterpretacionIA from "../components/InterpretacionIA";
import { contextoRazones, hayDatosEnPeriodo } from "../services/aiContexts";
export default function Ratios() {
  const { data } = useFinance();
  const p = data.periods[data.selected],
    previous = data.periods[data.selected - 1],
    r = ratios(p, previous, data.accounts),
    s = statements(p, data.accounts);
  const definitions = [
    [
      "Liquidez",
      "Capital de trabajo neto",
      "ctn",
      "Activo corriente − Pasivo corriente",
      "money",
    ],
    [
      "Liquidez",
      "Razón corriente",
      "current",
      "Activo corriente / Pasivo corriente",
      "times",
    ],
    [
      "Liquidez",
      "Prueba ácida",
      "acid",
      "(Activo corriente − Inventarios) / Pasivo corriente",
      "times",
    ],
    [
      "Actividad",
      "Rotación de inventario",
      "inventoryRotation",
      "Costo de ventas / Inventario promedio",
      "times",
    ],
    [
      "Actividad",
      "Edad promedio de inventario",
      "inventoryDays",
      "Días del período / Rotación de inventario",
      "days",
    ],
    [
      "Actividad",
      "Rotación de CxC",
      "arRotation",
      "Ventas a crédito / CxC promedio",
      "times",
    ],
    [
      "Actividad",
      "Período promedio de cobro",
      "collectionDays",
      "Días del período / Rotación de CxC",
      "days",
    ],
    [
      "Actividad",
      "Rotación de CxP",
      "apRotation",
      "Compras a crédito / CxP promedio",
      "times",
    ],
    [
      "Actividad",
      "Período promedio de pago",
      "paymentDays",
      "Días del período / Rotación de CxP",
      "days",
    ],
    [
      "Actividad",
      "Rotación de activos fijos",
      "fixedRotation",
      "Ventas / Activos fijos netos promedio",
      "times",
    ],
    [
      "Actividad",
      "Rotación de activos totales",
      "turnover",
      "Ventas / Activos totales promedio",
      "times",
    ],
    [
      "Endeudamiento",
      "Razón de endeudamiento",
      "debt",
      "Pasivos / Activos",
      "percent",
    ],
    [
      "Endeudamiento",
      "Deuda / patrimonio",
      "debtEquity",
      "Pasivos / Patrimonio",
      "times",
    ],
    [
      "Endeudamiento",
      "Cobertura de intereses",
      "interestCoverage",
      "UAII / Intereses",
      "times",
    ],
    [
      "Rentabilidad",
      "Margen bruto",
      "grossMargin",
      "Utilidad bruta / Ventas",
      "percent",
    ],
    [
      "Rentabilidad",
      "Margen operativo",
      "operatingMargin",
      "UAII / Ventas",
      "percent",
    ],
    [
      "Rentabilidad",
      "Margen neto",
      "margin",
      "Utilidad neta / Ventas",
      "percent",
    ],
    [
      "Rentabilidad",
      "ROA",
      "roa",
      "Utilidad neta / Activo promedio",
      "percent",
    ],
    [
      "Rentabilidad",
      "ROE",
      "roe",
      "Utilidad neta / Patrimonio promedio",
      "percent",
    ],
  ];
  const fmt = (v, type) =>
    type === "money"
      ? money(v, data.currency)
      : type === "percent"
        ? percent(v)
        : type === "days"
          ? `${number(v)}${v == null ? "" : " días"}`
          : times(v);
  const exportRows = definitions.map(([g, l, k, f, t]) => [
    g,
    l,
    f,
    fmt(r[k], t),
  ]);
  return (
    <div className="module-stack">
      <Notice>
        {previous
          ? `Promedios entre ${previous.label} y ${p.label}.`
          : "Solo hay un balance disponible: se utilizan saldos de cierre como aproximación."}{" "}
        Liquidez y endeudamiento usan el cierre. Base de {number(r.days)} días;
        rentabilidad y rotaciones corresponden a la duración del período, sin
        anualizar. N/D indica denominador cero.
      </Notice>
      {s.equity <= 0 && (
        <Notice tone="warning">
          El patrimonio es cero o negativo. El ROE y el multiplicador pueden no
          ser interpretables económicamente.
        </Notice>
      )}
      <RatiosTheory r={r} s={s} currency={data.currency} />
      <Panel
        title="Sistema DuPont"
        subtitle="Tres factores que explican el rendimiento del patrimonio."
      >
        <div className="dupont">
          <Metric
            label="Margen neto"
            value={percent(r.margin)}
            detail="Utilidad neta / Ventas"
          />
          <span>×</span>
          <Metric
            label="Rotación de activos"
            value={times(r.turnover)}
            detail="Ventas / Activo promedio"
          />
          <span>×</span>
          <Metric
            label="Multiplicador del capital"
            value={times(r.multiplier)}
            detail="Activo promedio / Patrimonio promedio"
          />
          <span>=</span>
          <Metric
            label="ROE DuPont"
            value={percent(r.dupont)}
            detail={`ROE directo: ${percent(r.roe)}`}
            tone="blue"
          />
        </div>
        <p className="helper">
          El margen explica cuánto se gana, la rotación cuánto venden los
          activos y el multiplicador cuánto financiamiento respalda al
          patrimonio. Un mayor multiplicador no implica por sí solo una mejor
          situación.
        </p>
      </Panel>
      <div className="section-top">
        <h2>Indicadores financieros</h2>
        <Export
          name="razones-financieras.csv"
          headers={["Grupo", "Indicador", "Fórmula", "Resultado"]}
          rows={exportRows}
        />
      </div>
      <div className="two-columns">
        {["Liquidez", "Actividad", "Endeudamiento", "Rentabilidad"].map((g) => (
          <Panel key={g} title={g}>
            <Table
              headers={["Indicador / fórmula", "Resultado"]}
              rows={definitions
                .filter((x) => x[0] === g)
                .map(([, l, k, f, t]) => [
                  <div key={k}>
                    {l}
                    <small className="formula">{f}</small>
                  </div>,
                  fmt(r[k], t),
                ])}
            />
          </Panel>
        ))}
      </div>
      <Notice>
        Compara los indicadores con el historial, el sector y las condiciones de
        crédito. Captura el porcentaje de ventas a crédito y las compras a
        crédito en el estado de resultados para obtener PPC y PPP.
      </Notice>
      <InterpretacionIA
        modulo="Razones y DuPont"
        obtenerContexto={() => contextoRazones(data, p, previous)}
        habilitado={hayDatosEnPeriodo(p)}
        motivoDeshabilitado="Registra un balance y un estado de resultados para calcular las razones."
      />
    </div>
  );
}
