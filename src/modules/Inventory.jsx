import { Trash2 } from "lucide-react";
import { useFinance } from "../lib/store";
import { stock, sum, num } from "../lib/finance";
import { money, number } from "../lib/format";
import {
  Panel,
  Notice,
  Field,
  Metric,
  Export,
  AddButton,
  Empty,
} from "../components/UI";
export default function Inventory() {
  const { data, update } = useFinance();
  const rows = data.inventory.map((x) => ({ ...x, ...stock(x) })),
    mf = (v) => money(v, data.currency);
  const edit = (i, k, v) =>
    update((d) => {
      d.inventory[i][k] = v;
    });
  return (
    <div className="module-stack">
      <div className="metrics-grid three">
        <Metric
          label="Productos registrados"
          value={data.inventory.length}
          detail="Control complementario de existencias"
        />
        <Metric
          label="Valor total del inventario"
          value={mf(sum(rows.map((x) => x.value)))}
          detail="Existencia final × costo unitario"
        />
        <Metric
          label="Productos por reponer"
          value={rows.filter((x) => x.low).length}
          detail="Existencia inferior al mínimo"
          tone={rows.some((x) => x.low) ? "amber" : ""}
        />
      </div>
      <Notice>
        Existencia final = inicial + entradas − salidas. Valoración a costo
        unitario constante. Este registro complementario no reemplaza
        automáticamente el inventario contable del balance.
      </Notice>
      <Panel
        title="Control de existencias"
        subtitle="Registra las cantidades y establece un mínimo para cada producto."
        action={
          <AddButton
            onClick={() =>
              update((d) =>
                d.inventory.push({
                  id: crypto.randomUUID(),
                  name: "",
                  initial: "",
                  incoming: "",
                  outgoing: "",
                  cost: "",
                  minimum: "",
                }),
              )
            }
          >
            Agregar producto
          </AddButton>
        }
      >
        <div className="inventory-list">
          {rows.map((row, i) => (
            <div className="inventory-card" key={row.id}>
              <div className="inventory-header">
                <Field
                  label="Producto / código"
                  type="text"
                  value={row.name}
                  onChange={(v) => edit(i, "name", v)}
                />
                <span
                  className={`badge ${row.invalid ? "danger" : row.low ? "warning" : "neutral"}`}
                >
                  {row.invalid
                    ? "Revisar salidas"
                    : row.low
                      ? "Reponer stock"
                      : "Stock suficiente"}
                </span>
                <button
                  className="icon-button danger-text"
                  aria-label={`Eliminar ${row.name || "producto"}`}
                  onClick={() =>
                    update((d) => {
                      d.inventory.splice(i, 1);
                    })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="form-grid inventory-fields">
                {[
                  ["initial", "Existencia inicial"],
                  ["incoming", "Entradas"],
                  ["outgoing", "Salidas"],
                  ["cost", "Costo unitario"],
                  ["minimum", "Stock mínimo"],
                ].map(([k, l]) => (
                  <Field
                    key={k}
                    label={l}
                    value={row[k]}
                    onChange={(v) => edit(i, k, v)}
                  />
                ))}
              </div>
              <div className="inventory-result">
                <span>
                  Existencia final <strong>{number(row.quantity)}</strong>
                </span>
                <span>
                  Valor del inventario <strong>{mf(row.value)}</strong>
                </span>
                <span>
                  Reposición sugerida{" "}
                  <strong>
                    {number(Math.max(0, num(row.minimum) - row.quantity))} unid.
                  </strong>
                </span>
              </div>
              {row.invalid && (
                <Notice tone="warning">
                  Las salidas superan la cantidad disponible. Corrige los
                  movimientos; la valoración negativa no es un saldo válido de
                  inventario.
                </Notice>
              )}
            </div>
          ))}
        </div>
        {!rows.length && (
          <Empty title="Tu inventario empieza aquí">
            Agrega un producto y registra sus movimientos para ver existencias y
            alertas.
          </Empty>
        )}
        <div className="panel-footer">
          <Export
            name="inventario.csv"
            headers={[
              "Producto",
              "Inicial",
              "Entradas",
              "Salidas",
              "Final",
              "Costo",
              "Valor",
              "Mínimo",
              "Estado",
            ]}
            rows={rows.map((x) => [
              x.name,
              num(x.initial),
              num(x.incoming),
              num(x.outgoing),
              x.quantity,
              num(x.cost),
              x.value,
              num(x.minimum),
              x.invalid ? "Inválido" : x.low ? "Reponer" : "Suficiente",
            ])}
          />
        </div>
      </Panel>
    </div>
  );
}
