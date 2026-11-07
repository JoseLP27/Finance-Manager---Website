import { useFinance } from "../lib/store";
import {
  statements,
  cvuInputs,
  cvu,
  change,
  divide,
  num,
} from "../lib/finance";
import { money, number, percent, times } from "../lib/format";
import {
  Panel,
  Notice,
  Field,
  Toggle,
  Metric,
  Table,
  Export,
} from "../components/UI";
import { BreakEvenChart } from "../components/Charts";
export default function Cvu() {
  const { data, update } = useFinance();
  const c = data.cvu,
    s = statements(data.periods[data.selected], data.accounts),
    input = cvuInputs(c, s),
    r = cvu(input);
  const edit = (k, v) =>
    update((d) => {
      d.cvu[k] = v;
    });
  const mf = (v) => money(v, data.currency);
  const next = {
      ...input,
      units: c.scenarioUnits === "" ? input.units : num(c.scenarioUnits),
      price:
        input.price == null
          ? null
          : input.price * (1 + num(c.priceChange) / 100),
      variable:
        input.variable == null
          ? null
          : input.variable * (1 + num(c.costChange) / 100),
      fixed: input.fixed * (1 + num(c.fixedChange) / 100),
    },
    n = cvu(next);
  const ds = r.valid && n.valid ? change(n.sales, r.sales) : null,
    de = r.valid && n.valid ? change(n.ebit, r.ebit) : null,
    dp =
      r.valid && n.valid && n.eps != null && r.eps != null
        ? change(n.eps, r.eps)
        : null;
  const rows = [
    ["Ventas", "sales"],
    ["Costos variables", "variableTotal"],
    ["Margen de contribución", "contribution"],
    ["UAII", "ebit"],
    ["Utilidad antes de impuestos", "ebt"],
    ["Impuestos", "tax"],
    ["Utilidad neta", "net"],
    ["Utilidad por acción (UPA)", "eps"],
  ].map(([l, k]) => [
    l,
    r.valid ? mf(r[k]) : "N/D",
    n.valid ? mf(n[k]) : "N/D",
  ]);
  return (
    <div className="module-stack">
      <Notice>
        El modelo supone un solo producto o una mezcla constante. En modo
        vinculado, el costo de ventas se trata como variable y los gastos
        operativos como fijos: verifica esta clasificación antes de interpretar
        el resultado.
      </Notice>
      <div className="two-columns">
        <Panel
          title="Base de operación"
          subtitle="Los importes corresponden al mismo período que tus estados."
        >
          <Toggle checked={c.linked} onChange={(v) => edit("linked", v)}>
            Usar ventas, costos, gastos, intereses e impuesto del estado
          </Toggle>
          <div className="form-grid two">
            {[
              ["units", "Unidades vendidas"],
              ["price", "Precio unitario"],
              ["variable", "Costo variable unitario"],
              ["fixed", "Costos fijos operativos"],
              ["interest", "Intereses"],
              ["taxRate", "Impuesto supuesto (%)"],
              ["dividends", "Dividendos preferentes (DAP)"],
              ["shares", "Acciones comunes"],
            ].map(([k, l]) => (
              <Field
                key={k}
                label={l}
                value={
                  c.linked &&
                  [
                    "price",
                    "variable",
                    "fixed",
                    "interest",
                    "taxRate",
                  ].includes(k)
                    ? input[k]
                    : c[k]
                }
                disabled={
                  c.linked &&
                  [
                    "price",
                    "variable",
                    "fixed",
                    "interest",
                    "taxRate",
                  ].includes(k)
                }
                max={k === "taxRate" ? 100 : undefined}
                onChange={(v) => edit(k, v)}
              />
            ))}
          </div>
        </Panel>
        <Panel
          title="Simular un escenario"
          subtitle="Modifica volumen, precio o costos y compara con la base sin alterar los estados."
        >
          <div className="form-grid two">
            <Field
              label="Unidades del escenario"
              value={c.scenarioUnits}
              hint="Vacío = unidades base."
              onChange={(v) => edit("scenarioUnits", v)}
            />
            {[
              ["priceChange", "Cambio en precio (%)"],
              ["costChange", "Cambio en CV unitario (%)"],
              ["fixedChange", "Cambio en costos fijos (%)"],
            ].map(([k, l]) => (
              <Field
                key={k}
                label={l}
                value={c[k]}
                min={-100}
                onChange={(v) => edit(k, v)}
              />
            ))}
          </div>
          <div className="metrics-grid compact">
            <Metric
              label="UAII del escenario"
              value={n.valid ? mf(n.ebit) : "N/D"}
              detail={`Variación: ${percent(de)}`}
            />
            <Metric
              label="UPA del escenario"
              value={n.valid ? mf(n.eps) : "N/D"}
              detail={`Variación: ${percent(dp)}`}
            />
          </div>
        </Panel>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Punto de equilibrio"
          value={r.q == null ? "N/D" : `${number(r.q)} unid.`}
          detail={
            r.q == null
              ? "Requiere P > CV y datos completos"
              : `Mínimo entero: ${Math.ceil(r.q).toLocaleString("en-US")} unidades`
          }
        />
        <Metric
          label="Ventas de equilibrio"
          value={mf(r.breakEvenMoney)}
          detail="Costos fijos / (1 − CV / P)"
        />
        <Metric
          label="Margen de contribución"
          value={mf(r.contributionUnit)}
          detail="Por unidad: precio − costo variable"
        />
        <Metric
          label="Margen de seguridad"
          value={percent(r.q == null ? null : r.safety)}
          detail="(Ventas en unidades − Q equilibrio) / Ventas"
        />
      </div>
      {r.valid && r.contributionUnit <= 0 && (
        <Notice tone="warning">
          El precio no supera el costo variable. No existe un punto de
          equilibrio operativo finito con margen de contribución positivo.
        </Notice>
      )}
      <div className="two-columns">
        <Panel
          title="Punto de equilibrio operativo"
          subtitle="Pasa sobre las líneas para explorar ingresos y costos."
        >
          {r.valid ? (
            <BreakEvenChart input={input} result={r} />
          ) : (
            <Notice>
              Ingresa unidades y datos operativos para generar la gráfica.
            </Notice>
          )}
        </Panel>
        <Panel
          title="Estado de resultados comparado"
          action={
            <Export
              name="escenario-cvu.csv"
              headers={["Concepto", "Base", "Escenario"]}
              rows={rows}
            />
          }
        >
          <Table headers={["Concepto", "Base", "Escenario"]} rows={rows} />
        </Panel>
      </div>
      <Panel
        title="Grados de apalancamiento"
        subtitle="Método directo en el nivel base; método de variaciones desde esa misma base."
      >
        <Table
          headers={["Indicador", "Fórmula directa", "Base", "Por variaciones"]}
          rows={[
            [
              "GAO",
              "Margen de contribución / UAII",
              times(r.gao),
              times(divide(de, ds)),
            ],
            [
              "GAF",
              "UAII / [UAII − Intereses − DAP/(1−T)]",
              times(r.gaf),
              times(divide(dp, de)),
            ],
            ["GAT", "GAO × GAF", times(r.gat), times(divide(dp, ds))],
            ["Cambio en ventas", "(Escenario − Base) / Base", percent(ds), ""],
            ["Cambio en UAII", "(Escenario − Base) / Base", percent(de), ""],
            ["Cambio en UPA", "(Escenario − Base) / Base", percent(dp), ""],
          ]}
        />
        <Notice>
          Los métodos coinciden cuando cambia solo el volumen, se mantienen
          costos, precio y estructura financiera, y ambas utilidades antes de
          impuestos son positivas. Si cambias otros supuestos o atraviesas una
          pérdida, las variaciones pueden diferir. N/D indica división por cero,
          tasa de 100% o datos insuficientes.
        </Notice>
      </Panel>
    </div>
  );
}
