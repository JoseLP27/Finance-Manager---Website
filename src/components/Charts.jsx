import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import { money, number } from "../lib/format";
import { useFinance } from "../lib/store";
const tick = { fontSize: 11, fill: "#7a879c" };
export function TrendChart({
  rows,
  lines = [
    ["sales", "Ventas", "#2154b6"],
    ["net", "Utilidad neta", "#12a17f"],
  ],
  area = true,
}) {
  const { data } = useFinance();
  const Chart = area ? AreaChart : LineChart;
  const Series = area ? Area : Line;
  return (
    <div
      className="chart"
      role="img"
      aria-label={lines.map((x) => x[1]).join(" y ") + " por período"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={rows} margin={{ top: 15, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="4 5"
            vertical={false}
            stroke="#e8edf5"
          />
          <XAxis
            dataKey="label"
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={tick}
            width={65}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              Math.abs(v) >= 1000 ? `${number(v / 1000)}k` : v
            }
          />
          <Tooltip
            formatter={(value, name) => [money(value, data.currency), name]}
            contentStyle={{ borderRadius: 12, border: "1px solid #e1e7f0" }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 15 }}
          />
          {lines.map(([key, label, color]) => (
            <Series
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={color}
              fill={color}
              fillOpacity={0.07}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
export function BreakEvenChart({ input, result }) {
  const { data } = useFinance();
  const max = Math.max(input.units * 1.3, (result.q ?? 0) * 1.5, 10);
  const rows = Array.from({ length: 21 }, (_, i) => {
    const q = (max * i) / 20;
    return {
      q,
      income: q * input.price,
      cost: input.fixed + q * input.variable,
    };
  });
  return (
    <div
      className="chart"
      role="img"
      aria-label="Ingresos totales y costos totales por unidades vendidas"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          margin={{ top: 25, right: 20, bottom: 20, left: 0 }}
        >
          <CartesianGrid strokeDasharray="4 5" vertical={false} />
          <XAxis
            type="number"
            dataKey="q"
            tick={tick}
            tickFormatter={(v) => Math.round(v).toLocaleString("en-US")}
            label={{
              value: "Unidades vendidas",
              position: "bottom",
              fontSize: 12,
            }}
          />
          <YAxis
            tick={tick}
            width={65}
            tickFormatter={(v) =>
              Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v
            }
          />
          <Tooltip
            labelFormatter={(q) => `${number(q)} unidades`}
            formatter={(v, n) => [money(v, data.currency), n]}
          />
          <Legend verticalAlign="top" height={35} iconType="circle" />
          {result.q != null && (
            <ReferenceLine
              x={result.q}
              stroke="#12a17f"
              strokeDasharray="5 5"
              label={{ value: "Equilibrio", fontSize: 12, fill: "#078360" }}
            />
          )}
          <Line
            dataKey="income"
            name="Ingresos totales"
            stroke="#2154b6"
            dot={false}
            strokeWidth={3}
            isAnimationActive={false}
          />
          <Line
            dataKey="cost"
            name="Costos totales"
            stroke="#91a1b9"
            dot={false}
            strokeWidth={3}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
