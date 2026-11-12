import { useFinance } from "../lib/store";
import {
  proforma,
  proformaFields,
  blankProforma,
  change,
  hasValue,
} from "../lib/finance";
import { money, number, percent } from "../lib/format";
import {
  Panel,
  Field,
  Notice,
  Table,
  Metric,
  Export,
  Button,
} from "../components/UI";
import { ProformaTheory } from "../content/theoryGuides";
import InterpretacionIA from "../components/InterpretacionIA";
import { contextoProforma, hayDatosEnPeriodo } from "../services/aiContexts";

export default function Proforma() {
  const { data, update } = useFinance();
  const p = data.periods[data.selected],
    prev = data.periods[data.selected - 1],
    config = data.proforma ?? blankProforma(),
    r = proforma(config, p, prev, data.accounts),
    mf = (v) => money(v, data.currency);
  const edit = (k, v) =>
    update((d) => {
      d.proforma ??= blankProforma();
      d.proforma[k] = v;
    });
  const show = (k, type, v) => (type === "money" ? mf(v) : `${number(v)}%`);
  const incomeRows = [
    ["Ventas", "sales"],
    ["(−) Costo de ventas", "cogs"],
    ["Utilidad bruta", "gross"],
    ["(−) Gastos operativos", "opex"],
    ["(−) Depreciación", "depreciation"],
    ["UAII / utilidad operativa", "ebit"],
    ["(±) Otros ingresos netos (se mantienen)", "otherIncome"],
    ["(−) Intereses", "interest"],
    ["Utilidad antes de impuestos", "ebt"],
    ["(−) Impuestos", "tax"],
    ["Utilidad neta", "net"],
  ];
  const incomeRaw = [
    ...incomeRows.map(([l, k]) => [l, r.current[k], r.income[k]]),
    ["Dividendos", r.actualDividends, r.income.dividends],
    [
      "Utilidad retenida del período",
      r.current.net - r.actualDividends,
      r.retainedAdded,
    ],
  ];
  const balanceRaw = [
    ...r.assets.map(([, l, a, b]) => [l, a, b]),
    ["TOTAL ACTIVO", r.actualAssets, r.totalAssets],
    ...r.liabilities.map(([, l, a, b]) => [l, a, b]),
    ["TOTAL PASIVO + PATRIMONIO", r.actualLiabEq, r.totalLiabEq],
    [
      "Financiamiento externo requerido (FER)",
      r.actualAssets - r.actualLiabEq,
      r.fer,
    ],
  ];
  const custom = proformaFields.some(([k]) => hasValue(config[k]));
  return (
    <div className="module-stack">
      <Notice>
        Proyecta el siguiente período a partir de {p.label} con el método de
        porcentaje de ventas. Cada supuesto vacío usa la proporción real del
        período; escribe un valor para simular otro escenario. Los estados
        reales no se modifican.
      </Notice>
      <ProformaTheory r={r} currency={data.currency} />
      <div className="metrics-grid">
        <Metric
          label="Ventas proforma"
          value={mf(r.income.sales)}
          detail={`Variación: ${percent(change(r.income.sales, r.current.sales))}`}
        />
        <Metric
          label="Utilidad neta proforma"
          value={mf(r.income.net)}
          detail={`Actual: ${mf(r.current.net)}`}
        />
        <Metric
          label="Activo total proforma"
          value={mf(r.totalAssets)}
          detail={`Actual: ${mf(r.actualAssets)}`}
        />
        <Metric
          label="Financiamiento externo requerido"
          value={mf(r.fer)}
          detail={
            r.fer > 0.005
              ? "Se necesitan fondos adicionales"
              : r.fer < -0.005
                ? "Hay excedente de fondos"
                : "Sin necesidad de financiamiento"
          }
          tone={r.fer > 0.005 ? "amber" : "blue"}
        />
      </div>
      <Panel
        title="Supuestos de proyección"
        subtitle="Vacío = proporción real del período analizado (se muestra debajo de cada campo)."
        action={
          custom && (
            <Button
              secondary
              onClick={() =>
                update((d) => {
                  d.proforma = blankProforma();
                })
              }
            >
              Usar proporciones reales
            </Button>
          )
        }
      >
        <div className="form-grid">
          {proformaFields.map(([k, label, type]) => (
            <Field
              key={k}
              label={label}
              value={config[k]}
              min={k === "growth" ? -100 : 0}
              max={["taxRate", "payoutPct"].includes(k) ? 100 : undefined}
              onChange={(v) => edit(k, v)}
              hint={`Vacío = ${show(k, type, r.actual[k])}${
                hasValue(config[k])
                  ? ` · En uso: ${show(k, type, r.assumptions[k])}`
                  : ""
              }`}
            />
          ))}
        </div>
        {!prev && (
          <Notice tone="warning">
            Sin un período anterior, los dividendos y la compra de activos fijos
            parten de cero. Agrega el período base en Estados financieros o
            escribe esos supuestos.
          </Notice>
        )}
      </Panel>
      <div className="two-columns">
        <Panel
          title="Estado de resultados proforma"
          subtitle={`Actual (${p.label}) frente a la proyección`}
          action={
            <Export
              name="estado-resultados-proforma.csv"
              headers={["Concepto", "Actual", "Proforma"]}
              rows={incomeRaw}
            />
          }
        >
          <Table
            headers={["Concepto", "Actual", "Proforma"]}
            rows={incomeRaw.map(([l, a, b]) => [l, mf(a), mf(b)])}
          />
        </Panel>
        <Panel
          title="Balance general proforma"
          subtitle="Las cuentas sin relación directa con las ventas se mantienen."
          action={
            <Export
              name="balance-proforma.csv"
              headers={["Concepto", "Actual", "Proforma"]}
              rows={balanceRaw}
            />
          }
        >
          <Table
            headers={["Concepto", "Actual", "Proforma"]}
            rows={balanceRaw.map(([l, a, b]) => [l, mf(a), mf(b)])}
          />
        </Panel>
      </div>
      <Notice tone={r.fer > 0.005 ? "warning" : "info"}>
        {r.fer > 0.005
          ? `Para sostener el crecimiento proyectado se requieren ${mf(r.fer)} de financiamiento externo (deuda o capital). Ese monto cuadra el balance proforma.`
          : r.fer < -0.005
            ? `La proyección genera un excedente de ${mf(-r.fer)}: los fondos internos superan lo que requieren los activos. Puede destinarse a reducir deuda, invertir o repartir.`
            : "Los fondos internos cubren exactamente los activos proyectados."}{" "}
        FER = activo proforma − (pasivo + patrimonio proforma). Si el balance
        actual no cuadra, esa diferencia también se refleja en el FER.
      </Notice>
      <InterpretacionIA
        modulo="Estados proforma"
        obtenerContexto={() => contextoProforma(data, p, prev)}
        habilitado={hayDatosEnPeriodo(p)}
        motivoDeshabilitado="Registra los estados financieros del período para proyectar los estados proforma."
      />
    </div>
  );
}
