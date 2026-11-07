import { useState } from "react";
import { Download, Info, ArrowUpRight, Plus } from "lucide-react";
import { useFinance } from "../lib/store";
import { money, csv } from "../lib/format";
export function Button({
  children,
  secondary = false,
  className = "",
  ...props
}) {
  return (
    <button
      className={`${secondary ? "btn-secondary" : "btn-primary"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Field({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = "any",
  type = "number",
  hint,
  disabled = false,
  ...props
}) {
  const [error, setError] = useState("");
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        placeholder={type === "number" ? "0.00" : ""}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={(e) => {
          if (type === "number") {
            const v = e.target.value;
            if (v === "") {
              setError("");
              onChange("");
              return;
            }
            if (
              !Number.isFinite(+v) ||
              Math.abs(+v) > 1e15 ||
              (step === 1 && !Number.isInteger(+v)) ||
              (min != null && +v < min) ||
              (max != null && +v > max)
            ) {
              setError(
                `Ingresa un valor ${step === 1 ? "entero " : ""}${min != null ? "desde " + min : ""}${max != null ? " hasta " + max : ""}.`,
              );
              return;
            }
            setError("");
            onChange(+v);
          } else onChange(e.target.value);
        }}
        {...props}
      />
      {(error || hint) && (
        <small className={error ? "text-red-600" : ""}>{error || hint}</small>
      )}
    </label>
  );
}
export function Select({ label, value, onChange, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}
export function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Notice({ children, tone = "info" }) {
  return (
    <div className={`notice ${tone}`}>
      <Info size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "",
  onClick,
}) {
  return (
    <div className={`metric ${tone}`}>
      <div className="metric-label">
        {label}
        {Icon && (
          <span className="metric-icon">
            <Icon size={18} />
          </span>
        )}
      </div>
      <strong>{value}</strong>
      <div className="metric-detail">
        {detail}
        {onClick && (
          <button onClick={onClick} aria-label={`Ver ${label}`}>
            <ArrowUpRight size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
export function Table({ headers, rows, caption }) {
  return (
    <div
      className="table-wrap"
      tabIndex={0}
      aria-label={caption || "Tabla de resultados"}
    >
      <table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) =>
                j === 0 ? (
                  <th scope="row" key={j}>
                    {cell}
                  </th>
                ) : (
                  <td key={j}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="empty-line">
          Aún no hay registros. Agrega el primero para comenzar.
        </p>
      )}
    </div>
  );
}
export function Export({ name, headers, rows }) {
  return (
    <Button secondary onClick={() => csv(name, [headers, ...rows])}>
      <Download size={15} /> Exportar CSV
    </Button>
  );
}
export function Toggle({ checked, onChange, children }) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
export function Money({ value }) {
  const { data } = useFinance();
  return money(value, data.currency);
}
export function AddButton({ children, onClick }) {
  return (
    <Button secondary onClick={onClick}>
      <Plus size={16} />
      {children}
    </Button>
  );
}
export function Empty({ title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <Plus size={26} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export const chartColors = [
  "#2154b6",
  "#65a4ed",
  "#17a589",
  "#a5b8d8",
  "#d49b37",
  "#8666c9",
];
