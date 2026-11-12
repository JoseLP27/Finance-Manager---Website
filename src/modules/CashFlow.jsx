import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useFinance } from "../lib/store";
import { cashFlow, statements, num } from "../lib/finance";
import { money } from "../lib/format";
import {
  Panel,
  Field,
  Select,
  Notice,
  Table,
  Metric,
  Export,
  AddButton,
  Toggle,
} from "../components/UI";
import { CashFlowTheory } from "../content/theoryGuides";
import InterpretacionIA from "../components/InterpretacionIA";
import { contextoEfe } from "../services/aiContexts";
export default function CashFlow() {
  const { data, update } = useFinance();
  const [method, setMethod] = useState("direct");
  const p = data.periods[data.selected],
    prev = data.periods[data.selected - 1],
    f = cashFlow(data.flow, p, prev, data.accounts),
    s = statements(p, data.accounts),
    mf = (v) => money(v, data.currency);
  const settings = data.flow.settings?.[p.id] || {};
  const setSetting = (k, v) =>
    update((d) => {
      d.flow.settings ??= {};
      d.flow.settings[p.id] ??= {};
      d.flow.settings[p.id][k] = v;
    });
  const groups = {
    operating: "Operación",
    investing: "Inversión",
    financing: "Financiamiento",
  };
  const edit = (i, k, v) =>
    update((d) => {
      d.flow.entries[i][k] = v;
    });
  const linked = f.linked;
  const reconciliation = linked
    ? [
        ...f.lines.indirect.map((l) => [l.label, l.value]),
        ["Flujo operativo indirecto", f.indirect],
      ]
    : [
        ["Utilidad neta", s.net],
        ["+ Depreciación", s.depreciation],
        ["− Variación de CxC", -f.delta("receivables")],
        ["− Variación de inventario", -f.delta("inventory")],
        ["− Variación de otros activos corrientes", -f.delta("otherCurrent")],
        ["+ Variación de proveedores", f.delta("payables")],
        ["+ Variación de impuestos por pagar", f.delta("taxPayable")],
        ["+ Variación de otros pasivos corrientes", f.delta("otherDebt")],
        ["± Otros ajustes", num(settings.adjustments)],
        ["Flujo operativo indirecto", f.indirect],
      ];
  // Tabla del método directo derivada de los estados (modo vinculado).
  const derivedRows = linked
    ? Object.entries(groups).flatMap(([g, label]) => [
        [
          <strong key={g}>{`Actividades de ${label.toLowerCase()}`}</strong>,
          "",
        ],
        ...f.lines[g].map((l) => [l.label, mf(l.value)]),
        [
          <strong key={g + "t"}>{`Flujo de ${label.toLowerCase()}`}</strong>,
          <strong key={g + "v"}>{mf(f[g])}</strong>,
        ],
      ])
    : [];
  return (
    <div className="module-stack">
      <Panel
        title="Origen de los datos"
        subtitle="Vinculado: el EFE se calcula con el balance anterior, el balance actual y el estado de resultados. Manual: registras cada cobro y pago."
      >
        <Toggle
          checked={data.flow.linked === true}
          onChange={(v) =>
            update((d) => {
              d.flow.linked = v;
            })
          }
        >
          Calcular el flujo desde el balance y el estado de resultados
        </Toggle>
        {data.flow.linked && !prev && (
          <Notice tone="warning">
            El modo vinculado necesita dos balances consecutivos. Agrega el
            período anterior en Estados financieros; mientras tanto se usan los
            movimientos manuales.
          </Notice>
        )}
      </Panel>
      <Notice>
        {linked
          ? `Calculado con las variaciones entre ${prev.label} y ${p.label}. Compras de activo fijo = Δ activo fijo neto + depreciación; dividendos = utilidad neta − Δ utilidades retenidas y reservas. Si ambos balances cuadran, el saldo final coincide con el efectivo del balance.`
          : "Registra movimientos reales del período seleccionado. Intereses e impuestos se clasifican como operación; préstamos y principal como financiamiento. La depreciación solo interviene en la conciliación indirecta."}
      </Notice>
      <CashFlowTheory f={f} s={s} currency={data.currency} />
      <div className="tabs">
        <button
          className={method === "direct" ? "active" : ""}
          onClick={() => setMethod("direct")}
        >
          Método directo
        </button>
        <button
          className={method === "indirect" ? "active" : ""}
          onClick={() => setMethod("indirect")}
        >
          Método indirecto
        </button>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Operación"
          value={mf(method === "direct" ? f.operating : f.indirect)}
          detail={
            method === "direct"
              ? "Cobros − pagos operativos"
              : "Utilidad ajustada a efectivo"
          }
        />
        <Metric
          label="Inversión"
          value={mf(f.investing)}
          detail="Compra y venta de activos"
        />
        <Metric
          label="Financiamiento"
          value={mf(f.financing)}
          detail="Capital y deuda"
        />
        <Metric
          label="Saldo final de caja"
          value={mf(method === "direct" ? f.final : f.indirectFinal)}
          detail={`Saldo inicial: ${mf(f.initial)}`}
          tone="blue"
        />
      </div>
      <Panel
        title="Saldo inicial"
        subtitle={
          prev
            ? `Vinculado al efectivo del balance ${prev.label}.`
            : "Con un solo balance, ingresa el efectivo al inicio del período."
        }
      >
        <div className="form-grid">
          <Field
            label="Efectivo inicial"
            value={prev ? f.initial : settings.initialCash}
            disabled={!!prev}
            onChange={(v) => setSetting("initialCash", v)}
          />
        </div>
      </Panel>
      {method === "direct" && linked ? (
        <Panel
          title="Método directo derivado de los estados"
          subtitle="Cobros y pagos estimados con las partidas del estado de resultados ajustadas por las variaciones del balance."
        >
          <Table headers={["Concepto", data.currency]} rows={derivedRows} />
        </Panel>
      ) : method === "direct" ? (
        <Panel
          title="Movimientos de efectivo"
          subtitle="Cada movimiento se suma a su actividad. Los importes se capturan positivos."
          action={
            <AddButton
              onClick={() =>
                update((d) =>
                  d.flow.entries.push({
                    id: crypto.randomUUID(),
                    label: "",
                    group: "operating",
                    direction: "in",
                    amount: "",
                    periodId: p.id,
                  }),
                )
              }
            >
              Agregar movimiento
            </AddButton>
          }
        >
          <div className="entry-list">
            {data.flow.entries.map(
              (entry, i) =>
                entry.periodId === p.id && (
                  <div key={entry.id} className="entry-row">
                    <Field
                      label="Concepto"
                      type="text"
                      value={entry.label}
                      onChange={(v) => edit(i, "label", v)}
                    />
                    <Select
                      label="Actividad"
                      value={entry.group}
                      onChange={(v) => edit(i, "group", v)}
                    >
                      {Object.entries(groups).map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Movimiento"
                      value={entry.direction}
                      onChange={(v) => edit(i, "direction", v)}
                    >
                      <option value="in">Entrada</option>
                      <option value="out">Salida</option>
                    </Select>
                    <Field
                      label={`Importe ${data.currency}`}
                      value={entry.amount}
                      onChange={(v) => edit(i, "amount", v)}
                    />
                    <button
                      className="icon-button danger-text"
                      aria-label={`Eliminar ${entry.label || "movimiento"}`}
                      onClick={() =>
                        update((d) => {
                          d.flow.entries.splice(i, 1);
                        })
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ),
            )}
          </div>
          {!data.flow.entries.some((e) => e.periodId === p.id) && (
            <p className="empty-line">
              Sin movimientos. Agrega los cobros y pagos efectivamente
              realizados.
            </p>
          )}
        </Panel>
      ) : (
        <Panel
          title="De la utilidad al efectivo"
          subtitle="Los cambios del capital de trabajo se toman de dos balances consecutivos."
        >
          {prev ? (
            <Table
              headers={["Conciliación", data.currency]}
              rows={reconciliation.map(([l, v]) => [l, mf(v)])}
            />
          ) : (
            <Notice tone="warning">
              Agrega un balance inicial y otro final en Estados financieros. El
              método indirecto necesita ambos para calcular las variaciones.
            </Notice>
          )}
          {!linked && (
            <div className="form-grid">
              <Field
                label="Otros ajustes no monetarios / capital de trabajo (±)"
                min={null}
                value={settings.adjustments}
                onChange={(v) => setSetting("adjustments", v)}
                hint="Incluye aquí cambios en cuentas adicionales y elimina ganancias por venta de activos."
              />
            </div>
          )}
        </Panel>
      )}
      <Panel
        title="Resumen y conciliación"
        action={
          <Export
            name="flujo-efectivo.csv"
            headers={["Concepto", data.currency]}
            rows={[
              ...(linked
                ? Object.keys(groups).flatMap((g) =>
                    f.lines[g].map((l) => [l.label, l.value]),
                  )
                : []),
              ["Saldo inicial", f.initial],
              ["Operación directa", f.operating],
              ["Operación indirecta", f.indirect],
              ["Inversión", f.investing],
              ["Financiamiento", f.financing],
              ["Variación neta directa", f.net],
              ["Saldo final directo", f.final],
            ]}
          />
        }
      >
        <Table
          headers={["Concepto", data.currency]}
          rows={[
            ["Variación neta de efectivo (directo)", mf(f.net)],
            ["Saldo final directo", mf(f.final)],
            ["Saldo final indirecto", mf(f.indirectFinal)],
            ["Efectivo en balance actual", mf(num(p.balance.cash))],
            ["Diferencia directo − balance", mf(f.final - num(p.balance.cash))],
            ["Diferencia operación directa − indirecta", mf(f.reconciliation)],
          ]}
        />
        {prev && Math.abs(f.reconciliation) > 0.005 && (
          <Notice tone="warning">
            Los métodos no concilian. Revisa movimientos, saldos y ajustes; la
            diferencia debe explicarse antes de presentar el estado.
          </Notice>
        )}
      </Panel>
      <InterpretacionIA
        modulo="Flujo de efectivo"
        obtenerContexto={() => contextoEfe(data, p, prev)}
        habilitado={
          data.flow.entries.some((e) => e.periodId === p.id) || Boolean(prev)
        }
        motivoDeshabilitado="Registra movimientos de efectivo o agrega un período anterior para usar el método indirecto."
      />
    </div>
  );
}
