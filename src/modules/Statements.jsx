import { useState } from "react";
import { useFinance } from "../lib/store";
import {
  accountGroups,
  incomeFields,
  statements,
  blankPeriod,
  divide,
  change,
  num,
} from "../lib/finance";
import { money, percent } from "../lib/format";
import {
  Panel,
  Field,
  Select,
  Notice,
  Table,
  Button,
  Export,
  AddButton,
  Metric,
} from "../components/UI";
import { StatementsTheory } from "../content/theoryGuides";
import InterpretacionIA from "../components/InterpretacionIA";
import { contextoEstados, hayDatosEnPeriodo } from "../services/aiContexts";
export default function Statements() {
  const { data, update } = useFinance();
  const [tab, setTab] = useState("balance");
  const [base, setBase] = useState(0);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("current");
  const index = data.selected,
    p = data.periods[index],
    anterior = data.periods[index - 1],
    s = statements(p, data.accounts),
    prev = data.periods[Math.min(base, data.periods.length - 1)],
    ps = statements(prev, data.accounts);
  const edit = (section, key, value) =>
    update((d) => {
      d.periods[index][section][key] = value;
    });
  const mf = (v) => money(v, data.currency);
  const balanceLoaded = Object.values(p.balance).some(
    (v) => v !== "" && v != null,
  );
  const balanceRows = [
    ...Object.entries(accountGroups).flatMap(([groupId, label]) => [
      ...data.accounts
        .filter((a) => a.group === groupId)
        .map((a) => [
          a.label,
          num(p.balance[a.id]) * (a.id === "accDep" ? -1 : 1),
        ]),
      [`Total ${label.toLowerCase()}`, s[groupId]],
    ]),
    ["TOTAL ACTIVOS", s.assets],
    ["TOTAL PASIVOS", s.liabilities],
    ["TOTAL PATRIMONIO", s.equity],
    ["TOTAL PASIVOS + PATRIMONIO", s.liabilities + s.equity],
    ["Diferencia: activos − pasivos − patrimonio", s.difference],
  ];
  const resultRows = [
    ["Ventas netas", "sales"],
    ["Costo de ventas", "cogs"],
    ["Utilidad bruta", "gross"],
    ["Gastos desembolsables", "opex"],
    ["Depreciación", "depreciation"],
    ["UAII / utilidad operativa", "ebit"],
    ["Otros ingresos netos", "otherIncome"],
    ["Intereses", "interest"],
    ["Utilidad antes de impuestos", "ebt"],
    ["Impuestos", "tax"],
    ["Utilidad neta", "net"],
  ];
  const analysis =
    tab === "vertical-income"
      ? resultRows.map(([label, key]) => [
          label,
          ps[key],
          s[key],
          divide(ps[key], ps.sales),
          divide(s[key], s.sales),
        ])
      : [
          ...data.accounts.map((a) => [
            a.label,
            num(prev.balance[a.id]) * (a.id === "accDep" ? -1 : 1),
            num(p.balance[a.id]) * (a.id === "accDep" ? -1 : 1),
          ]),
          ["Total activos", ps.assets, s.assets],
          ["Total pasivos", ps.liabilities, s.liabilities],
          ["Total patrimonio", ps.equity, s.equity],
        ].map(([label, a, b]) => [
          label,
          a,
          b,
          divide(a, ps.assets),
          divide(b, s.assets),
        ]);
  const raw = analysis.map(([label, a, b, va, vb]) => [
    label,
    a,
    b,
    percent(va),
    percent(vb),
    b - a,
    percent(change(b, a)),
  ]);
  const headers = [
    "Cuenta",
    prev.label,
    p.label,
    `Vertical ${prev.label}`,
    `Vertical ${p.label}`,
    `Variación ${data.currency}`,
    "Variación %",
  ];
  return (
    <div className="module-stack">
      <Panel
        title="Una base para todo tu análisis"
        subtitle="Registra los saldos de cierre y los resultados de cada período. Los demás módulos se actualizan al editar estos datos."
        action={
          <AddButton
            onClick={() =>
              update((d) => {
                d.periods.push(blankPeriod(`Período ${d.periods.length + 1}`));
                d.selected = d.periods.length - 1;
              })
            }
          >
            Agregar período
          </AddButton>
        }
      >
        <div className="form-grid">
          <Field
            label="Nombre del período"
            type="text"
            value={p.label}
            onChange={(v) =>
              update((d) => {
                d.periods[index].label = v;
              })
            }
          />
          <Field
            label="Duración en meses"
            value={p.months}
            min={1}
            max={12}
            step={1}
            onChange={(v) =>
              update((d) => {
                d.periods[index].months = v || 1;
              })
            }
            hint="12 meses = 365 días para las razones."
          />
          <Select
            label="Período de comparación"
            value={Math.min(base, data.periods.length - 1)}
            onChange={(v) => setBase(+v)}
          >
            {data.periods.map((x, i) => (
              <option key={x.id} value={i}>
                {x.label}
              </option>
            ))}
          </Select>
        </div>
        {data.periods.length > 1 && (
          <button
            className="text-button danger-text"
            onClick={() => {
              if (
                window.confirm(
                  `¿Eliminar ${p.label} y sus datos? Descarga un respaldo si deseas conservarlos.`,
                )
              )
                update((d) => {
                  const removed = d.periods[index].id;
                  d.flow.entries = d.flow.entries.filter(
                    (e) => e.periodId !== removed,
                  );
                  delete d.flow.settings[removed];
                  d.periods.splice(index, 1);
                  d.selected = Math.max(0, index - 1);
                });
            }}
          >
            Eliminar este período
          </button>
        )}
      </Panel>
      <div className="tabs" aria-label="Vistas de estados">
        {[
          ["balance", "Balance general"],
          ["income", "Estado de resultados"],
          ["vertical-balance", "Análisis del balance"],
          ["vertical-income", "Análisis de resultados"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <StatementsTheory
        s={s}
        ps={ps}
        p={p}
        prev={prev}
        currency={data.currency}
      />
      {tab === "balance" && (
        <>
          <Panel
            title="Resultado del balance general"
            subtitle={`${data.company || "Empresa sin nombre"} · ${p.label}. Se actualiza automáticamente al ingresar o cambiar los saldos.`}
            action={
              <Export
                name="balance-general.csv"
                headers={["Cuenta", data.currency]}
                rows={balanceRows}
              />
            }
          >
            <div className="metrics-grid">
              <Metric
                label="Total activos"
                value={mf(s.assets)}
                detail="Bienes y derechos"
              />
              <Metric
                label="Total pasivos"
                value={mf(s.liabilities)}
                detail="Obligaciones de la empresa"
              />
              <Metric
                label="Total patrimonio"
                value={mf(s.equity)}
                detail="Capital, reservas y utilidades"
              />
              <Metric
                label="Pasivos + patrimonio"
                value={mf(s.liabilities + s.equity)}
                detail="Debe coincidir con los activos"
                tone="blue"
              />
            </div>
            <Notice
              tone={
                balanceLoaded && Math.abs(s.difference) > 0.005
                  ? "warning"
                  : "info"
              }
            >
              {!balanceLoaded
                ? "Sin saldos registrados. Ingresa las cuentas para obtener el resultado del balance."
                : Math.abs(s.difference) <= 0.005
                  ? `Balance cuadrado: ${mf(s.assets)} = ${mf(s.liabilities)} + ${mf(s.equity)}. Diferencia: ${mf(s.difference)}.`
                  : `Balance descuadrado. Activos − (pasivos + patrimonio) = ${mf(s.difference)}.`}
            </Notice>
            <details className="financial-report">
              <summary>Ver balance completo por cuentas</summary>
              <Table
                caption={`Balance general de ${p.label}`}
                headers={["Cuenta", data.currency]}
                rows={balanceRows.map(([label, value]) => [label, mf(value)])}
              />
            </details>
          </Panel>
          <Notice tone={Math.abs(s.difference) > 0.005 ? "warning" : "info"}>
            {Math.abs(s.difference) > 0.005
              ? `El balance no cuadra: diferencia de ${mf(s.difference)}. Revisa activos, pasivos y patrimonio.`
              : "Ecuación contable: Activo = Pasivo + Patrimonio. Los campos vacíos se consideran cero."}{" "}
            La utilidad del ejercicio debe estar incluida en patrimonio; no se
            añade automáticamente para evitar duplicarla.
          </Notice>
          <div className="two-columns">
            {Object.entries(accountGroups).map(([key, label]) => (
              <Panel
                key={key}
                title={label}
                action={<strong className="subtotal">{mf(s[key])}</strong>}
              >
                <div className="fields-stack">
                  {data.accounts
                    .filter((a) => a.group === key)
                    .map((a) => (
                      <Field
                        key={a.id}
                        label={a.label}
                        value={p.balance[a.id]}
                        min={a.group === "equity" ? null : 0}
                        onChange={(v) => edit("balance", a.id, v)}
                      />
                    ))}
                </div>
              </Panel>
            ))}
          </div>
          <Panel
            title="Agregar una cuenta"
            subtitle="Las cuentas adicionales participan en el balance y en el análisis estructural. Para razones y EFE, utiliza las cuentas principales de inventarios, clientes y proveedores."
          >
            <div className="form-grid">
              <Field
                label="Nombre de la cuenta"
                type="text"
                value={name}
                onChange={setName}
              />
              <Select label="Grupo contable" value={group} onChange={setGroup}>
                {Object.entries(accountGroups).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              <Button
                disabled={!name.trim()}
                onClick={() => {
                  update((d) =>
                    d.accounts.push({
                      id: crypto.randomUUID(),
                      label: name.trim(),
                      group,
                    }),
                  );
                  setName("");
                }}
              >
                Agregar cuenta
              </Button>
            </div>
          </Panel>
        </>
      )}
      {tab === "income" && (
        <div className="two-columns">
          <Panel
            title="Ingresos y gastos"
            subtitle="Captura costos y gastos como importes positivos. La tasa es un supuesto académico."
          >
            <div className="fields-stack">
              {incomeFields.map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  value={p.income[key]}
                  max={["taxRate", "creditPct"].includes(key) ? 100 : undefined}
                  min={key === "otherIncome" ? null : 0}
                  onChange={(v) => edit("income", key, v)}
                />
              ))}
            </div>
          </Panel>
          <Panel
            title="Estado de resultados"
            subtitle={p.label}
            action={
              <Export
                name="estado-resultados.csv"
                headers={["Cuenta", data.currency]}
                rows={resultRows.map(([l, k]) => [l, s[k]])}
              />
            }
          >
            <Table
              headers={["Cuenta", data.currency]}
              rows={resultRows.map(([l, k]) => [l, mf(s[k])])}
            />
            <Notice>
              Utilidad neta = UAII + otros ingresos − intereses − impuestos. Si
              hay pérdida, el impuesto calculado es cero; no se supone un
              crédito fiscal.
            </Notice>
          </Panel>
        </div>
      )}
      {tab.startsWith("vertical") && (
        <Panel
          title="Análisis vertical y horizontal"
          subtitle="Vertical: cada cuenta / total de activos o ventas. Horizontal: (actual − base) / base."
          action={
            <Export
              name="analisis-financiero.csv"
              headers={headers}
              rows={raw}
            />
          }
        >
          <Table
            headers={headers}
            rows={raw.map((r) => [
              r[0],
              mf(r[1]),
              mf(r[2]),
              r[3],
              r[4],
              mf(r[5]),
              r[6],
            ])}
          />
          <Notice>
            {data.periods.length === 1
              ? "Agrega otro período para hacer una comparación horizontal. "
              : ""}
            N/D indica una base igual a cero. El análisis conserva los decimales
            completos y redondea solo al mostrar.
          </Notice>
        </Panel>
      )}
      <InterpretacionIA
        modulo="Estados financieros"
        obtenerContexto={() => contextoEstados(data, p, anterior)}
        habilitado={hayDatosEnPeriodo(p)}
        motivoDeshabilitado="Registra al menos un saldo o resultado en este período para generar la interpretación."
      />
    </div>
  );
}
