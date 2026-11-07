import { Trash2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useFinance } from "../lib/store";
import { personalTotals, num } from "../lib/finance";
import { money, percent } from "../lib/format";
import {
  Panel,
  Notice,
  Field,
  Select,
  Metric,
  Export,
  AddButton,
  Empty,
  chartColors,
} from "../components/UI";
import InterpretacionIA from "../components/InterpretacionIA";
import { contextoPersonal } from "../services/aiContexts";
export default function Personal() {
  const { data, update } = useFinance();
  const p = personalTotals(data.personal),
    mf = (v) => money(v, data.currency);
  const edit = (i, k, v) =>
    update((d) => {
      d.personal[i][k] = v;
    });
  const groups = {};
  data.personal
    .filter((x) => x.kind !== "income")
    .forEach((x) => {
      const k = x.category.trim() || "Sin categoría";
      groups[k] = (groups[k] || 0) + num(x.amount);
    });
  const slices = Object.entries(groups)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
  return (
    <div className="module-stack">
      <Notice>
        Este presupuesto mensual es independiente de la empresa. Registra
        ingresos y gastos propios; no modifica los estados ni el presupuesto
        maestro.
      </Notice>
      <div className="metrics-grid">
        <Metric
          label="Ingresos mensuales"
          value={mf(p.income)}
          detail="Suma de todas las fuentes"
        />
        <Metric
          label="Gastos mensuales"
          value={mf(p.expenses)}
          detail="Fijos + variables"
        />
        <Metric
          label="Saldo disponible"
          value={mf(p.balance)}
          detail={
            p.balance < 0
              ? "Tus gastos superan tus ingresos"
              : "Ingresos menos gastos"
          }
          tone={p.balance < 0 ? "amber" : "blue"}
        />
        <Metric
          label="Capacidad de ahorro"
          value={percent(p.savings)}
          detail="Saldo / ingresos × 100"
        />
      </div>
      <div className="two-columns wide-left">
        <Panel
          title="Tu presupuesto mensual"
          action={
            <AddButton
              onClick={() =>
                update((d) =>
                  d.personal.push({
                    id: crypto.randomUUID(),
                    category: "",
                    kind: "income",
                    amount: "",
                  }),
                )
              }
            >
              Agregar registro
            </AddButton>
          }
        >
          <div className="entry-list">
            {data.personal.map((row, i) => (
              <div className="entry-row personal" key={row.id}>
                <Field
                  label="Categoría"
                  type="text"
                  value={row.category}
                  onChange={(v) => edit(i, "category", v)}
                />
                <Select
                  label="Tipo"
                  value={row.kind}
                  onChange={(v) => edit(i, "kind", v)}
                >
                  <option value="income">Ingreso</option>
                  <option value="fixed">Gasto fijo</option>
                  <option value="variable">Gasto variable</option>
                </Select>
                <Field
                  label={`Monto ${data.currency}`}
                  value={row.amount}
                  onChange={(v) => edit(i, "amount", v)}
                />
                <button
                  className="icon-button danger-text"
                  aria-label={`Eliminar ${row.category || "registro"}`}
                  onClick={() =>
                    update((d) => {
                      d.personal.splice(i, 1);
                    })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
          {!data.personal.length && (
            <Empty title="Empieza con tus ingresos">
              Agrega salario, otros ingresos y los gastos de tu mes.
            </Empty>
          )}
          <div className="panel-footer">
            <Export
              name="presupuesto-personal.csv"
              headers={["Categoría", "Tipo", data.currency]}
              rows={data.personal.map((x) => [
                x.category,
                x.kind,
                num(x.amount),
              ])}
            />
          </div>
        </Panel>
        <Panel
          title="Distribución de gastos"
          subtitle="Participación de cada categoría en el gasto total."
        >
          {slices.length ? (
            <div className="chart donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    innerRadius={65}
                    outerRadius={95}
                    dataKey="value"
                    paddingAngle={3}
                    isAnimationActive={false}
                  >
                    {slices.map((_, i) => (
                      <Cell
                        key={i}
                        fill={chartColors[i % chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => mf(v)} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="Aún no hay gastos">
              La distribución aparecerá al registrar tus gastos.
            </Empty>
          )}
        </Panel>
      </div>
      <InterpretacionIA
        modulo="Presupuesto personal"
        obtenerContexto={() => contextoPersonal(data)}
        habilitado={data.personal.length > 0}
        motivoDeshabilitado="Agrega al menos un ingreso o gasto personal para generar la interpretación."
      />
    </div>
  );
}
