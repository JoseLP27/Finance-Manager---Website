import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useFinance } from "../lib/store";
import { plan, blankMonth, num } from "../lib/finance";
import { money, number } from "../lib/format";
import {
  Panel,
  Notice,
  Field,
  Toggle,
  Metric,
  Table,
  Export,
  AddButton,
} from "../components/UI";
import { TrendChart } from "../components/Charts";
import InterpretacionIA from "../components/InterpretacionIA";
import { contextoPresupuesto } from "../services/aiContexts";
export default function Budget() {
  const { data, update } = useFinance();
  const [tab, setTab] = useState("inputs");
  const b = data.budget,
    p = data.periods[data.selected],
    r = plan(b, p, data.accounts),
    mf = (v) => money(v, data.currency);
  const edit = (k, v) =>
    update((d) => {
      d.budget[k] = v;
    });
  const em = (i, k, v) =>
    update((d) => {
      d.budget.months[i][k] = v;
    });
  const definitions =
    tab === "sales"
      ? [
          ["Unidades de venta", "units", "units"],
          ["Precio unitario", "price"],
          ["Ventas", "sales"],
          ["Cobros del mes", "currentCollections"],
          ["Ventas a crédito pendientes", "receivables"],
        ]
      : tab === "purchases"
        ? [
            ["Inventario inicial (unidades)", "openingUnits", "units"],
            ["Ventas (unidades)", "units", "units"],
            ["Inventario final real (unidades)", "closingUnits", "units"],
            ["Unidades a comprar", "purchaseUnits", "units"],
            ["Compras", "purchases"],
            ["Inventario inicial valorado", "openingValue"],
            ["Inventario final valorado", "closingValue"],
            ["Costo de ventas", "cogs"],
          ]
        : tab === "income"
          ? [
              ["Ventas", "sales"],
              ["Costo de ventas", "cogs"],
              ["Utilidad bruta", "gross"],
              ["Gastos desembolsables", "expense"],
              ["Depreciación", "depreciation"],
              ["UAII", "ebit"],
              ["Intereses", "interest"],
              ["Utilidad antes de impuestos", "ebt"],
              ["Impuestos", "tax"],
              ["Utilidad neta", "net"],
            ]
          : [
              ["Saldo inicial", "openingCash"],
              ["Cobros de ventas actuales", "currentCollections"],
              ["Cobros pendientes / mes anterior", "previousCollections"],
              ["Total cobros a clientes", "collections"],
              ["Otras entradas", "otherIn"],
              ["Pagos de compras actuales", "currentPayments"],
              ["Pagos pendientes / mes anterior", "previousPayments"],
              ["Total pagos a proveedores", "payments"],
              ["Gastos, intereses, impuestos y otras salidas", "otherOut"],
              ["Saldo final", "closingCash"],
              ["Necesidad para alcanzar el mínimo", "need"],
            ];
  const rowValue = (row, key) =>
    key === "price"
      ? num(b.price)
      : key === "openingValue"
        ? row.openingUnits * num(b.cost)
        : key === "closingValue"
          ? row.closingUnits * num(b.cost)
          : num(row[key]);
  const tableRows = definitions.map(([label, key, type]) => [
    label,
    ...r.rows.map((row) =>
      type === "units" ? number(rowValue(row, key)) : mf(rowValue(row, key)),
    ),
  ]);
  return (
    <div className="module-stack">
      <Notice>
        La planeación parte del estado seleccionado o de supuestos manuales. El
        crédito se cobra o paga íntegramente al mes siguiente; los saldos
        iniciales pendientes se liquidan en el primer mes. Impuestos e intereses
        se pagan en el mes.
      </Notice>
      <div className="metrics-grid">
        <Metric
          label="Ventas proyectadas"
          value={mf(r.totals.sales)}
          detail={`${b.months.length} meses de planeación`}
        />
        <Metric
          label="Compras proyectadas"
          value={mf(r.totals.purchases)}
          detail="Ventas + inventario final − inicial"
        />
        <Metric
          label="Utilidad neta proyectada"
          value={mf(r.totals.net)}
          detail="Resultado del horizonte completo"
        />
        <Metric
          label="Caja al final del plan"
          value={mf(r.rows.at(-1)?.closingCash)}
          detail={
            r.rows.some((x) => x.need > 0)
              ? "Hay meses bajo la reserva mínima"
              : "Sin faltantes respecto al mínimo"
          }
          tone={r.rows.some((x) => x.need > 0) ? "amber" : "blue"}
        />
      </div>
      <div className="tabs">
        {[
          ["inputs", "Supuestos"],
          ["sales", "Ventas"],
          ["purchases", "Compras y costo de ventas"],
          ["income", "Gastos y resultados"],
          ["cash", "Presupuesto de caja"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "inputs" ? (
        <>
          <Panel
            title="Supuestos del presupuesto"
            subtitle="Sin cifras precargadas. Completa precio, costo y políticas para comenzar."
          >
            <Toggle checked={b.linked} onChange={(v) => edit("linked", v)}>
              Vincular automáticamente con el estado financiero seleccionado
            </Toggle>
            <div className="form-grid">
              {[
                ["price", "Precio de venta unitario"],
                ["cost", "Costo unitario de inventario"],
                ["cashPct", "Ventas al contado (%)"],
                ["payPct", "Compras pagadas en el mes (%)"],
                ["minimum", "Reserva mínima de caja"],
              ].map(([k, l]) => (
                <Field
                  key={k}
                  label={l}
                  value={b[k]}
                  max={k.endsWith("Pct") ? 100 : undefined}
                  onChange={(v) => edit(k, v)}
                />
              ))}
              <Field
                label="Ventas a crédito (%)"
                value={100 - num(b.cashPct)}
                disabled
              />
              <Field
                label="Impuesto supuesto (%)"
                value={b.linked ? r.taxRate : b.taxRate}
                disabled={b.linked}
                max={100}
                onChange={(v) => edit("taxRate", v)}
              />
              {[
                ["initialUnits", "Inventario inicial (unidades)"],
                ["initialCash", "Caja inicial"],
                ["receivables", "CxC anteriores por cobrar"],
                ["payables", "CxP anteriores por pagar"],
              ].map(([k, l]) => (
                <Field
                  key={k}
                  label={l}
                  value={b.linked ? r[k] : b[k]}
                  disabled={b.linked}
                  onChange={(v) => edit(k, v)}
                />
              ))}
            </div>
            {b.linked && (
              <p className="helper">
                Base mensual = ventas históricas / {p.months} meses. Unidades =
                base mensual / precio; luego se aplica el crecimiento de cada
                mes. Gastos, depreciación e intereses se dividen entre{" "}
                {p.months} meses. El inventario inicial se convierte a unidades
                usando el costo unitario.
              </p>
            )}
          </Panel>
          <Panel
            title="Plan mensual"
            subtitle="El inventario deseado es una cantidad en unidades. Cada cierre pasa a ser la apertura del mes siguiente."
            action={
              <AddButton
                onClick={() =>
                  update((d) =>
                    d.budget.months.push(
                      blankMonth(`Mes ${d.budget.months.length + 1}`),
                    ),
                  )
                }
              >
                Agregar mes
              </AddButton>
            }
          >
            <div className="month-grid">
              {b.months.map((m, i) => (
                <div className="month-card" key={m.id}>
                  <div className="month-title">
                    <span>MES {String(i + 1).padStart(2, "0")}</span>
                    <button
                      className="icon-button danger-text"
                      aria-label={`Eliminar ${m.label}`}
                      disabled={b.months.length === 1}
                      onClick={() =>
                        update((d) => {
                          d.budget.months.splice(i, 1);
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <Field
                    label="Nombre"
                    type="text"
                    value={m.label}
                    onChange={(v) => em(i, "label", v)}
                  />
                  {b.linked ? (
                    <Field
                      label="Crecimiento sobre base / mes anterior (%)"
                      min={-100}
                      value={m.growth}
                      onChange={(v) => em(i, "growth", v)}
                    />
                  ) : (
                    <Field
                      label="Unidades a vender"
                      value={m.units}
                      onChange={(v) => em(i, "units", v)}
                    />
                  )}
                  <Field
                    label="Inventario final deseado (unid.)"
                    value={m.desired}
                    onChange={(v) => em(i, "desired", v)}
                  />
                  {!b.linked &&
                    [
                      ["expense", "Gastos desembolsables"],
                      ["depreciation", "Depreciación"],
                      ["interest", "Intereses"],
                    ].map(([k, l]) => (
                      <Field
                        key={k}
                        label={l}
                        value={m[k]}
                        onChange={(v) => em(i, k, v)}
                      />
                    ))}
                  <Field
                    label="Otras entradas de caja"
                    value={m.otherIn}
                    onChange={(v) => em(i, "otherIn", v)}
                  />
                  <Field
                    label="Otras salidas de caja"
                    value={m.otherOut}
                    onChange={(v) => em(i, "otherOut", v)}
                  />
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : (
        <Panel
          title={
            {
              sales: "Presupuesto de ventas",
              purchases: "Compras, inventarios y costo de ventas",
              income: "Estado de resultados presupuestado",
              cash: "Calendario mensual de caja",
            }[tab]
          }
          action={
            <Export
              name={`presupuesto-${tab}.csv`}
              headers={["Concepto", ...r.rows.map((x) => x.label)]}
              rows={definitions.map(([l, k]) => [
                l,
                ...r.rows.map((row) => rowValue(row, k)),
              ])}
            />
          }
        >
          <Table
            headers={["Concepto", ...r.rows.map((x) => x.label)]}
            rows={tableRows}
          />
          {tab === "purchases" && (
            <Notice>
              Compras = máximo(0, ventas + inventario deseado − inventario
              inicial). Si sobra inventario inicial, se conserva ese excedente y
              no se generan compras negativas. Costo de ventas = inventario
              inicial valorado + compras − inventario final valorado.
            </Notice>
          )}
          {tab === "cash" && (
            <>
              {r.rows
                .filter((row) => row.need > 0)
                .map((row) => (
                  <Notice tone="warning" key={row.id}>
                    {row.label}:{" "}
                    {row.closingCash < 0
                      ? "déficit de caja"
                      : "saldo inferior a la reserva mínima"}
                    . Faltan {mf(row.need)} para alcanzar el mínimo. No se
                    agrega financiamiento automáticamente.
                  </Notice>
                ))}
              <TrendChart
                rows={r.rows}
                lines={[["closingCash", "Saldo final de caja", "#2154b6"]]}
              />
            </>
          )}
        </Panel>
      )}
      {!r.valid && (
        <Notice tone="warning">
          Ingresa precio de venta y costo unitario mayores que cero para
          completar el presupuesto. Los resultados actuales son parciales.
        </Notice>
      )}
      <InterpretacionIA
        modulo="Presupuesto maestro"
        obtenerContexto={() => contextoPresupuesto(data, p)}
        habilitado={r.valid}
        motivoDeshabilitado="Ingresa precio de venta y costo unitario mayores que cero para interpretar el presupuesto."
      />
    </div>
  );
}
