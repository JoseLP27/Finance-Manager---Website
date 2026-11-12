// Exportación a Excel (.xlsx) basada en la plantilla «Plantilla_Sistema_GFO».
//
// - Estructura y estilo de la plantilla: 00_Portada … 11_Fórmulas, celdas amarillas
//   para datos de entrada, barras de sección azules, semáforos y gráficos.
// - Fórmulas legibles: cada dato y resultado clave tiene un NOMBRE DEFINIDO de Excel
//   (p. ej. Ventas_Act, Activo_Corriente_Ant, Razon_Corriente), así una razón se lee
//   =IFERROR(Activo_Corriente_Act/Pasivo_Corriente_Act,"N/D") en lugar de
//   ='02_Estados'!$D$31/'02_Estados'!$D$38. La hoja 11_Fórmulas lista todos los nombres.
// - Gráficos nativos: se agregan al paquete .xlsx con excelCharts.js.
// - Las fórmulas replican lib/finance.js (sufijo _Act = período analizado,
//   _Ant = período base/anterior).
import {
  accountGroups,
  defaultAccounts,
  linkedFlowSpec,
  num,
  proforma,
  proformaFields,
  hasValue,
} from "../lib/finance.js";
import { injectCharts, ref } from "./excelCharts.js";

export const SHEET_NAMES = {
  portada: "00_Portada",
  panel: "01_Panel",
  estados: "02_Estados",
  analisis: "03_Análisis",
  equilibrio: "04_Equilibrio",
  apalancamiento: "05_Apalancamiento",
  flujo: "06_Flujo",
  presupuestos: "07_Presupuestos",
  proforma: "08_Proforma",
  personal: "09_Personal",
  inventario: "10_Inventario",
  formulas: "11_Fórmulas",
};

export const EXPORT_SECTIONS = {
  completo: {
    label: "Libro completo",
    file: "libro-completo",
    sheets: Object.keys(SHEET_NAMES),
  },
  estados: {
    label: "Estados financieros",
    file: "estados-financieros",
    sheets: ["portada", "estados", "analisis", "formulas"],
  },
  razones: {
    label: "Razones y DuPont",
    file: "razones-dupont",
    sheets: ["portada", "estados", "analisis", "formulas"],
  },
  equilibrio: {
    label: "Equilibrio y apalancamiento",
    file: "equilibrio-apalancamiento",
    sheets: ["portada", "estados", "equilibrio", "apalancamiento", "formulas"],
  },
  efectivo: {
    label: "Flujo de efectivo",
    file: "flujo-efectivo",
    sheets: ["portada", "estados", "flujo", "formulas"],
  },
  presupuesto: {
    label: "Presupuesto y proforma",
    file: "presupuesto-proforma",
    sheets: ["portada", "estados", "presupuestos", "proforma", "formulas"],
  },
  proforma: {
    label: "Estados proforma",
    file: "estados-proforma",
    sheets: ["portada", "estados", "proforma", "formulas"],
  },
  personal: {
    label: "Presupuesto personal",
    file: "presupuesto-personal",
    sheets: ["portada", "personal", "formulas"],
  },
  inventario: {
    label: "Control de inventario",
    file: "inventario",
    sheets: ["portada", "inventario", "formulas"],
  },
};

/* ───────────────────────── estilo de la plantilla ───────────────────────── */

const P = {
  navy: "FF1F3A5F",
  blue: "FF3F6FA3",
  blue2: "FF2B4C78",
  gray: "FF6B7788",
  light: "FFF3F5F8",
  inFill: "FFFFF9E6",
  inFont: "FF0000AA",
  total: "FFE8EEF5",
  border: "FFDDE3EA",
  info: "FFEEF3F9",
  okFill: "FFE2EFDA",
  ok: "FF3D8B6A",
  bad: "FFB25555",
  gold: "FFC08A2E",
  white: "FFFFFFFF",
  black: "FF000000",
};
const hex = (argb) => argb.slice(2);
const thin = { style: "thin", color: { argb: P.border } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
function font({ color = P.black, ...o } = {}) {
  const f = { name: "Calibri", size: 11 };
  for (const [k, v] of Object.entries(o)) if (v !== undefined) f[k] = v;
  f.color = { argb: color };
  return f;
}
const solid = (argb) => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

export const colLetter = (n) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

function formats(currency) {
  const c = `"${currency.replaceAll('"', "")}"`;
  return {
    money: `${c}#,##0.00;[Red]-${c}#,##0.00`,
    money0: `${c}#,##0;[Red]-${c}#,##0`,
    pct: "0.00%",
    times: '0.00"x"',
    days: '0.0" días"',
    units: "#,##0.00",
    units0: '#,##0" u"',
    rate: '0.00"%"',
    int: "0",
  };
}

// Contenido de celda: dato editable, fórmula o texto/número fijo.
const inp = (value) => ({ kind: "input", value });
const fx = (formula) => ({ kind: "formula", formula });
const inputValue = (v) =>
  v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
const nd = (expr) => `IFERROR(${expr},"N/D")`;

class Book {
  constructor(wb, data, sheets) {
    this.wb = wb;
    this.data = data;
    this.fmt = formats(data.currency || "C$");
    this.sheets = new Set(sheets);
    this.names = [];
    this.charts = {};
  }
  has(key) {
    return this.sheets.has(key);
  }
  /** Registra un nombre definido de libro que apunta a una celda. */
  name(name, sheetKey, addr, desc) {
    const [, col, row] = addr.match(/^([A-Z]+)(\d+)$/);
    const sheet = SHEET_NAMES[sheetKey];
    if (this.names.some((n) => n.name.toLowerCase() === name.toLowerCase()))
      throw Error(`Nombre definido duplicado: ${name}`);
    this.wb.definedNames.add(
      `'${sheet.replaceAll("'", "''")}'!$${col}$${row}`,
      name,
    );
    this.names.push({ name, sheet, addr: `${col}${row}`, desc });
  }
  chart(sheetKey, item) {
    (this.charts[SHEET_NAMES[sheetKey]] ??= []).push(item);
  }
}

class Sheet {
  constructor(book, key, { title, subtitle, widths }) {
    this.book = book;
    this.key = key;
    this.name = SHEET_NAMES[key];
    this.fmt = book.fmt;
    this.ws = book.wb.addWorksheet(this.name, {
      views: [{ showGridLines: false }],
      properties: { tabColor: { argb: P.navy } },
    });
    this.ws.columns = widths.map((width) => ({ width }));
    this.last = widths.length;
    this.bar(2, title, { fill: P.navy, size: 18, height: 40 });
    this.bar(3, subtitle, {
      fill: P.light,
      color: P.gray,
      size: 10,
      bold: false,
      italic: true,
      height: 22,
    });
  }
  merge(row, from, to) {
    if (to > from) this.ws.mergeCells(row, from, row, to);
  }
  bar(row, text, o = {}) {
    const {
      fill = P.blue,
      color = P.white,
      size = 12,
      bold = true,
      italic = false,
      from = 2,
      to = this.last,
      height = 26,
    } = o;
    this.merge(row, from, to);
    const c = this.ws.getRow(row).getCell(from);
    c.value = text;
    c.font = font({ bold, italic, size, color });
    c.fill = solid(fill);
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    this.ws.getRow(row).height = height;
  }
  note(row, text, { from = 2, to = this.last, height = 32 } = {}) {
    this.merge(row, from, to);
    const c = this.ws.getRow(row).getCell(from);
    c.value = text;
    c.font = font({ size: 10, color: P.navy });
    c.fill = solid(P.info);
    c.alignment = { wrapText: true, vertical: "middle", indent: 1 };
    this.ws.getRow(row).height = height;
  }
  header(row, labels, from = 2, fill = P.navy) {
    labels.forEach((label, i) => {
      const c = this.ws.getRow(row).getCell(from + i);
      c.value = label;
      c.font = font({ bold: true, size: 10, color: P.white });
      c.fill = solid(fill);
      c.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      c.border = box;
    });
    this.ws.getRow(row).height = 26;
  }
  label(addr, text, { bold = false, fill, color, size = 11, indent = 0 } = {}) {
    const c = this.ws.getCell(addr);
    c.value = text;
    c.font = font({ bold, color, size });
    if (fill) c.fill = solid(fill);
    c.alignment = {
      horizontal: "left",
      vertical: "middle",
      indent,
      wrapText: true,
    };
    c.border = box;
    return c;
  }
  muted(addr, text, { size = 9, italic = true } = {}) {
    const c = this.ws.getCell(addr);
    c.value = text;
    c.font = font({ size, italic, color: P.gray });
    c.alignment = { vertical: "middle", wrapText: true };
    return c;
  }
  /** Escribe contenido con el estilo de la plantilla y registra el nombre, si se indica. */
  put(addr, content, fmtKey, o = {}) {
    const c = this.ws.getCell(addr);
    c.border = box;
    c.alignment = { horizontal: o.align ?? "center", vertical: "middle" };
    if (o.fill) c.fill = solid(o.fill);
    c.font = font({ bold: o.bold, color: o.color, size: o.size });
    if (content != null) {
      if (typeof content !== "object") c.value = content;
      else if (content.kind === "input") {
        c.value = content.value;
        c.fill = solid(P.inFill);
        c.font = font({ bold: true, color: P.inFont, size: o.size });
      } else c.value = { formula: content.formula };
      if (fmtKey) c.numFmt = this.fmt[fmtKey];
    }
    if (o.name) this.book.name(o.name, this.key, addr, o.desc ?? "");
    return c;
  }
  freeze(xSplit, ySplit) {
    const first = `${colLetter(xSplit + 1)}${ySplit + 1}`;
    this.ws.views = [
      {
        state: "frozen",
        xSplit,
        ySplit,
        topLeftCell: first,
        activeCell: first,
        showGridLines: false,
      },
    ];
  }
}

/**
 * Tabla declarativa en dos pasos: layout() asigna filas (permite referencias hacia
 * adelante, p. ej. el inventario inicial del mes 2 = inventario final del mes 1) y
 * writeTable() escribe con estilos. cell(c, i, row) recibe la fila asignada.
 * Tipos: header | section | sub | note | row | total | key | blank
 */
function layout(items, start) {
  const R = {};
  let r = start;
  for (const it of items) {
    it.row = r;
    if (it.key) R[it.key] = r;
    r += 1;
  }
  return { R, end: r };
}

function writeTable(sheet, items, cols, o = {}) {
  const labelCol = o.labelCol ?? 2;
  const lc = colLetter(labelCol);
  const to = o.to ?? labelCol + cols.length + (o.noteCol ? 1 : 0);
  for (const it of items) {
    const r = it.row;
    if (it.kind === "blank") continue;
    if (it.kind === "header") {
      sheet.header(r, [it.label ?? "Concepto", ...it.headers], labelCol);
      continue;
    }
    if (it.kind === "section") {
      sheet.bar(r, it.label, { from: labelCol, to, fill: it.fill ?? P.blue });
      continue;
    }
    if (it.kind === "note") {
      sheet.note(r, it.label, { from: labelCol, to, height: it.height ?? 32 });
      continue;
    }
    const strong = ["total", "key", "sub"].includes(it.kind);
    const fill =
      it.kind === "total" || it.kind === "sub"
        ? P.total
        : it.kind === "key"
          ? P.okFill
          : undefined;
    sheet.label(`${lc}${r}`, it.label, {
      bold: strong,
      fill,
      indent: it.indent ?? 0,
    });
    if (it.kind === "sub") {
      for (let c = labelCol + 1; c <= to; c++) {
        const cell = sheet.ws.getRow(r).getCell(c);
        cell.fill = solid(P.total);
        cell.border = box;
      }
      continue;
    }
    cols.forEach((c, i) =>
      sheet.put(
        `${c}${r}`,
        it.cell?.(c, i, r) ?? null,
        it.fmtAt?.(i) ?? it.fmt,
        {
          bold: strong,
          fill,
          color: strong ? P.navy : undefined,
          name: it.name?.(i, c),
          desc: it.desc ?? it.label,
        },
      ),
    );
    if (o.noteCol && it.note) sheet.muted(`${o.noteCol}${r}`, it.note);
  }
}

const dataBar = (positive, negative) => ({
  type: "dataBar",
  cfvo: [{ type: "min" }, { type: "max" }],
  color: { argb: positive },
  gradient: false,
  border: false,
  negativeBarColorSameAsPositive: false,
  negativeFillColor: { argb: negative },
  axisPosition: "auto",
  minLength: 0,
  maxLength: 100,
});
const trafficLights = ([low, high, reverse = false]) => ({
  type: "iconSet",
  iconSet: "3TrafficLights1",
  reverse,
  showValue: true,
  cfvo: [
    { type: "percent", value: 0 },
    { type: "num", value: low },
    { type: "num", value: high },
  ],
});
// Texto del semáforo: rojo < bajo ≤ amarillo < alto ≤ verde (invertido: menor es mejor).
const semaforo = (cell, [low, high, reverse]) =>
  reverse
    ? `IF(ISNUMBER(${cell}),IF(${cell}>=${high},"🔴 Riesgo",IF(${cell}>=${low},"🟡 Precaución","🟢 Saludable")),"—")`
    : `IF(ISNUMBER(${cell}),IF(${cell}<${low},"🔴 Riesgo",IF(${cell}<${high},"🟡 Precaución","🟢 Saludable")),"—")`;

/* ───────────────────────── 02_Estados ───────────────────────── */

const INCOME = [
  ["sales", "Ventas netas", "Ventas"],
  ["cogs", "(−) Costo de ventas", "Costo_Ventas"],
  [
    "gross",
    "UTILIDAD BRUTA",
    "Utilidad_Bruta",
    (s) => `Ventas_${s}-Costo_Ventas_${s}`,
  ],
  ["opex", "(−) Gastos operativos desembolsables", "Gastos_Operativos"],
  ["depreciation", "(−) Depreciación del período", "Depreciacion"],
  [
    "ebit",
    "UTILIDAD OPERATIVA (UAII)",
    "UAII",
    (s) => `Utilidad_Bruta_${s}-Gastos_Operativos_${s}-Depreciacion_${s}`,
  ],
  ["otherIncome", "(±) Otros ingresos netos", "Otros_Ingresos"],
  ["interest", "(−) Intereses", "Intereses"],
  [
    "ebt",
    "UTILIDAD ANTES DE IMPUESTOS (UAI)",
    "UAI",
    (s) => `UAII_${s}+Otros_Ingresos_${s}-Intereses_${s}`,
  ],
  // Convención académica: sin crédito fiscal automático en pérdidas.
  [
    "tax",
    "(−) Impuesto sobre la renta",
    "Impuestos",
    (s) => `MAX(0,UAI_${s})*Tasa_ISR_${s}/100`,
  ],
  ["net", "UTILIDAD NETA", "Utilidad_Neta", (s) => `UAI_${s}-Impuestos_${s}`],
];
const SUBTOTALS = ["gross", "ebit", "ebt", "net"];
const INC_NAME = Object.fromEntries(INCOME.map(([k, , n]) => [k, n]));

const ACC_NAMES = {
  cash: "Efectivo",
  investments: "Inversiones_Temporales",
  receivables: "CxC",
  inventory: "Inventario",
  otherCurrent: "Otros_Activos_Corrientes",
  equipment: "PPE_Bruto",
  accDep: "Depreciacion_Acumulada",
  otherAsset: "Otros_Activos_NC",
  payables: "CxP",
  shortDebt: "Deuda_CP",
  taxPayable: "Impuestos_por_Pagar",
  otherDebt: "Otros_Pasivos_Corrientes",
  longDebt: "Deuda_LP",
  capital: "Capital_Social",
  reserves: "Reservas",
  retained: "Utilidades_Retenidas",
};
const GROUP_NAMES = {
  current: "Activo_Corriente",
  fixed: "Activo_Fijo_Neto",
  otherAsset: "Total_Otros_ANC",
  currentDebt: "Pasivo_Corriente",
  longDebt: "Pasivo_No_Corriente",
  equity: "Patrimonio",
};
const GROUP_TITLES = {
  current: "ACTIVO CORRIENTE",
  fixed: "ACTIVO FIJO",
  otherAsset: "OTROS ACTIVOS NO CORRIENTES",
  currentDebt: "PASIVO CORRIENTE",
  longDebt: "PASIVO NO CORRIENTE",
  equity: "PATRIMONIO",
};

function buildEstados(book, ctx) {
  const { data } = book;
  const { cur, prev } = ctx;
  const sh = new Sheet(book, "estados", {
    title: "📑  ESTADOS FINANCIEROS",
    subtitle: `${data.company || "Empresa sin nombre"} · Balance general y estado de resultados · Solo escribe en las celdas amarillas`,
    widths: [3, 48, 18, 18, 16, 13],
  });
  const periods = [prev, cur];
  const SUF = ["Ant", "Act"];
  let R;
  const items = [];
  /**
   * Fila con columnas Base (C) y Analizado (D) más variación (E, F).
   * value(i) devuelve el contenido de la columna i; baseName crea <baseName>_Ant/_Act.
   */
  const row = (o) => {
    const it = {
      ...o,
      fmtAt: (i) => (i === 3 ? "pct" : o.fmt),
      name:
        o.name ??
        ((i) => (i < 2 && o.baseName ? `${o.baseName}_${SUF[i]}` : undefined)),
      cell: (c, i, r) => {
        if (i < 2) return o.value(i, c);
        if (o.noVar) return null;
        return i === 2 ? fx(`D${r}-C${r}`) : fx(nd(`(D${r}-C${r})/C${r}`));
      },
    };
    items.push(it);
  };
  const input = (get) => (i) => inp(periods[i] ? get(periods[i]) : null);
  items.push({
    kind: "header",
    headers: [
      prev ? `Base: ${prev.label}` : "Base (sin período anterior)",
      `Analizado: ${cur.label}`,
      `Variación ${data.currency}`,
      "Variación %",
    ],
  });
  items.push({ kind: "section", label: "📅  DATOS DEL PERÍODO" });
  row({
    label: "Duración del período (meses)",
    fmt: "int",
    noVar: true,
    baseName: "Meses",
    value: input((p) => num(p.months) || 12),
  });
  row({
    label: "Tasa de impuesto sobre la renta (%)",
    fmt: "rate",
    noVar: true,
    baseName: "Tasa_ISR",
    value: input((p) => inputValue(p.income.taxRate)),
  });
  row({
    label: "Ventas a crédito (%)",
    fmt: "rate",
    noVar: true,
    baseName: "Pct_Ventas_Credito",
    value: input((p) => inputValue(p.income.creditPct)),
  });
  row({
    label: "Compras a crédito (para rotación de CxP)",
    fmt: "money",
    noVar: true,
    baseName: "Compras_Credito",
    value: input((p) => inputValue(p.income.creditPurchases)),
  });
  row({
    label: "¿Promediar con el período base en las razones? (1 = sí · 0 = no)",
    fmt: "int",
    noVar: true,
    name: (i) => (i === 1 ? "Usar_Promedios" : undefined),
    value: (i) => (i === 1 ? inp(prev ? 1 : 0) : null),
  });
  items.push({ kind: "section", label: "📊  ESTADO DE RESULTADOS" });
  for (const [key, label, baseName, calc] of INCOME)
    row({
      key: `inc:${key}`,
      kind: SUBTOTALS.includes(key) ? "total" : undefined,
      label,
      fmt: "money",
      baseName,
      value: calc
        ? (i) => fx(calc(SUF[i]))
        : input((p) => inputValue(p.income[key])),
    });
  items.push({ kind: "section", label: "🏦  BALANCE GENERAL" });
  for (const group of Object.keys(accountGroups)) {
    const accounts = data.accounts.filter((a) => a.group === group);
    items.push({ kind: "sub", label: GROUP_TITLES[group] });
    for (const a of accounts)
      row({
        key: `acc:${a.id}`,
        label: a.id === "accDep" ? "(−) Depreciación acumulada" : a.label,
        fmt: "money",
        indent: 1,
        baseName: ACC_NAMES[a.id],
        value: input((p) => inputValue(p.balance[a.id])),
      });
    row({
      key: `grp:${group}`,
      kind: "total",
      label: `TOTAL ${GROUP_TITLES[group]}${group === "fixed" ? " NETO" : ""}`,
      fmt: "money",
      baseName: GROUP_NAMES[group],
      value: (i, c) => {
        if (!accounts.length) return fx("0");
        if (group !== "fixed") {
          const rows = accounts.map((a) => R[`acc:${a.id}`]);
          return fx(`SUM(${c}${Math.min(...rows)}:${c}${Math.max(...rows)})`);
        }
        // Activo fijo neto = PPE bruto − Depreciación acumulada (+ otras cuentas del grupo).
        return fx(
          accounts
            .map((a, j) => {
              const refName = ACC_NAMES[a.id]
                ? `${ACC_NAMES[a.id]}_${SUF[i]}`
                : `${c}${R[`acc:${a.id}`]}`;
              return `${a.id === "accDep" ? "-" : j ? "+" : ""}${refName}`;
            })
            .join(""),
        );
      },
    });
    if (group === "otherAsset")
      row({
        key: "assets",
        kind: "total",
        label: "TOTAL ACTIVO",
        fmt: "money",
        baseName: "Activo_Total",
        value: (i) =>
          fx(
            `Activo_Corriente_${SUF[i]}+Activo_Fijo_Neto_${SUF[i]}+Total_Otros_ANC_${SUF[i]}`,
          ),
      });
    if (group === "longDebt")
      row({
        key: "liabilities",
        kind: "total",
        label: "TOTAL PASIVO",
        fmt: "money",
        baseName: "Pasivo_Total",
        value: (i) =>
          fx(`Pasivo_Corriente_${SUF[i]}+Pasivo_No_Corriente_${SUF[i]}`),
      });
  }
  row({
    key: "liabEq",
    kind: "total",
    label: "TOTAL PASIVO + PATRIMONIO",
    fmt: "money",
    baseName: "Pasivo_Patrimonio",
    value: (i) => fx(`Pasivo_Total_${SUF[i]}+Patrimonio_${SUF[i]}`),
  });
  items.push({
    kind: "section",
    label: "🔎  COMPROBACIÓN: ACTIVO = PASIVO + PATRIMONIO",
    fill: P.blue2,
  });
  row({
    key: "diff",
    kind: "key",
    label: "Diferencia (debe ser 0)",
    fmt: "money",
    noVar: true,
    baseName: "Diferencia_Balance",
    value: (i) => fx(`Activo_Total_${SUF[i]}-Pasivo_Patrimonio_${SUF[i]}`),
  });
  ({ R } = layout(items, 5));
  writeTable(sh, items, ["C", "D", "E", "F"]);
  sh.freeze(2, 5);
  // Accesos para las demás hojas: nombre definido si existe; si no, referencia directa.
  const cellRef = (key, s) =>
    `'${sh.name}'!$${s === "Act" ? "D" : "C"}$${R[key]}`;
  return {
    inc: (k, s) => `${INC_NAME[k]}_${s}`,
    acc: (id, s) =>
      ACC_NAMES[id]
        ? `${ACC_NAMES[id]}_${s}`
        : R[`acc:${id}`]
          ? cellRef(`acc:${id}`, s)
          : "0",
    grp: (g, s) => `${GROUP_NAMES[g]}_${s}`,
  };
}

/* ───────────────────────── 03_Análisis ───────────────────────── */

// [nombre, etiqueta, fórmula, fórmula en texto, formato, semáforo [bajo, alto, invertido] | null, interpretación]
const RATIOS = [
  ["LIQUIDEZ"],
  [
    "Capital_Trabajo_Neto",
    "Capital de trabajo neto",
    "Activo_Corriente_Act-Pasivo_Corriente_Act",
    "Activo corriente − Pasivo corriente",
    "money",
    [0, 0],
    "Excedente de recursos corrientes después de cubrir las deudas de corto plazo.",
  ],
  [
    "Razon_Corriente",
    "Razón corriente",
    nd("Activo_Corriente_Act/Pasivo_Corriente_Act"),
    "Activo corriente ÷ Pasivo corriente",
    "times",
    [1, 1.5],
    "Por cada C$1 de deuda corriente hay C$X de activo corriente.",
  ],
  [
    "Prueba_Acida",
    "Prueba ácida",
    nd("(Activo_Corriente_Act-Inventario_Act)/Pasivo_Corriente_Act"),
    "(Activo corriente − Inventarios) ÷ Pasivo corriente",
    "times",
    [0.8, 1],
    "Capacidad de pago inmediato sin depender de vender inventario.",
  ],
  ["ACTIVIDAD"],
  [
    "Rotacion_Inventario",
    "Rotación de inventario",
    nd("Costo_Ventas_Act/Inventario_Promedio"),
    "Costo de ventas ÷ Inventario promedio",
    "times",
    null,
    "Veces que el inventario se vende y repone en el período.",
  ],
  [
    "Dias_Inventario",
    "Edad promedio del inventario",
    nd("Dias_Periodo/Rotacion_Inventario"),
    "Días del período ÷ Rotación de inventario",
    "days",
    null,
    "Días que, en promedio, permanece el inventario en bodega.",
  ],
  [
    "Rotacion_CxC",
    "Rotación de cuentas por cobrar",
    nd("Ventas_Credito/CxC_Promedio"),
    "Ventas a crédito ÷ CxC promedio",
    "times",
    null,
    "Veces que se cobra la cartera en el período.",
  ],
  [
    "Periodo_Promedio_Cobro",
    "Período promedio de cobro",
    nd("Dias_Periodo/Rotacion_CxC"),
    "Días del período ÷ Rotación de CxC",
    "days",
    null,
    "Días que tarda la empresa en cobrar sus ventas a crédito.",
  ],
  [
    "Rotacion_CxP",
    "Rotación de cuentas por pagar",
    nd("Compras_Credito_Act/CxP_Promedio"),
    "Compras a crédito ÷ CxP promedio",
    "times",
    null,
    "Veces que se paga a proveedores en el período.",
  ],
  [
    "Periodo_Promedio_Pago",
    "Período promedio de pago",
    nd("Dias_Periodo/Rotacion_CxP"),
    "Días del período ÷ Rotación de CxP",
    "days",
    null,
    "Días que tarda la empresa en pagar a sus proveedores.",
  ],
  [
    "Rotacion_Activo_Fijo",
    "Rotación de activos fijos",
    nd("Ventas_Act/Activo_Fijo_Promedio"),
    "Ventas ÷ Activo fijo neto promedio",
    "times",
    null,
    "Ventas generadas por cada C$1 invertido en activo fijo.",
  ],
  [
    "Rotacion_Activos",
    "Rotación de activos totales",
    nd("Ventas_Act/Activo_Promedio"),
    "Ventas ÷ Activo total promedio",
    "times",
    null,
    "Ventas generadas por cada C$1 de activo total.",
  ],
  ["ENDEUDAMIENTO"],
  [
    "Razon_Endeudamiento",
    "Razón de endeudamiento",
    nd("Pasivo_Total_Act/Activo_Total_Act"),
    "Pasivo total ÷ Activo total",
    "pct",
    [0.5, 0.7, true],
    "Porcentaje de los activos financiado con deuda.",
  ],
  [
    "Deuda_Patrimonio",
    "Deuda / patrimonio",
    nd("Pasivo_Total_Act/Patrimonio_Act"),
    "Pasivo total ÷ Patrimonio",
    "times",
    [1, 2, true],
    "Deuda por cada C$1 aportado por los dueños.",
  ],
  [
    "Cobertura_Intereses",
    "Cobertura de intereses",
    nd("UAII_Act/Intereses_Act"),
    "UAII ÷ Intereses",
    "times",
    [1.5, 3],
    "Veces que la utilidad operativa cubre los intereses.",
  ],
  ["RENTABILIDAD"],
  [
    "Margen_Bruto",
    "Margen de utilidad bruta",
    nd("Utilidad_Bruta_Act/Ventas_Act"),
    "Utilidad bruta ÷ Ventas",
    "pct",
    [0, 0.2],
    "Ganancia después del costo de ventas.",
  ],
  [
    "Margen_Operativo",
    "Margen de utilidad operativa",
    nd("UAII_Act/Ventas_Act"),
    "UAII ÷ Ventas",
    "pct",
    [0, 0.1],
    "Ganancia después de los gastos operativos.",
  ],
  [
    "Margen_Neto",
    "Margen de utilidad neta",
    nd("Utilidad_Neta_Act/Ventas_Act"),
    "Utilidad neta ÷ Ventas",
    "pct",
    [0, 0.05],
    "Ganancia final por cada C$1 vendido.",
  ],
  [
    "Rendimiento_Activos",
    "ROA (rendimiento sobre activos)",
    nd("Utilidad_Neta_Act/Activo_Promedio"),
    "Utilidad neta ÷ Activo promedio",
    "pct",
    [0, 0.05],
    "Rendimiento generado por los activos.",
  ],
  [
    "Rendimiento_Patrimonio",
    "ROE (rendimiento sobre patrimonio)",
    nd("Utilidad_Neta_Act/Patrimonio_Promedio"),
    "Utilidad neta ÷ Patrimonio promedio",
    "pct",
    [0, 0.1],
    "Rentabilidad para los accionistas.",
  ],
];

function buildAnalisis(book, ctx, ef) {
  const { data } = book;
  const { cur, prev } = ctx;
  const sh = new Sheet(book, "analisis", {
    title: "📐  ANÁLISIS FINANCIERO",
    subtitle:
      "Vertical, horizontal, razones financieras y sistema DuPont · Se calcula desde 02_Estados",
    widths: [3, 42, 17, 17, 13, 13, 17, 13, 46],
  });
  const bl = prev ? prev.label : "Base",
    cl = cur.label;
  // 1. Vertical y horizontal
  let r = 5;
  sh.bar(r++, "🔹  1. ANÁLISIS VERTICAL Y HORIZONTAL");
  sh.note(
    r++,
    "Vertical = cuenta ÷ ventas (resultados) o ÷ activo total (balance). Horizontal = analizado − base y (analizado − base) ÷ base. N/D: base igual a cero.",
  );
  sh.header(r++, [
    "Cuenta",
    bl,
    cl,
    `Vertical ${bl}`,
    `Vertical ${cl}`,
    `Variación ${data.currency}`,
    "Variación %",
  ]);
  const first = r;
  const line = (label, ant, act, den, strong) => {
    const o = { bold: strong, fill: strong ? P.total : undefined };
    sh.label(`B${r}`, label, o);
    sh.put(`C${r}`, fx(ant), "money", o);
    sh.put(`D${r}`, fx(act), "money", o);
    sh.put(`E${r}`, fx(nd(`C${r}/${den}_Ant`)), "pct", o);
    sh.put(`F${r}`, fx(nd(`D${r}/${den}_Act`)), "pct", o);
    sh.put(`G${r}`, fx(`D${r}-C${r}`), "money", o);
    sh.put(`H${r}`, fx(nd(`(D${r}-C${r})/C${r}`)), "pct", o);
    r++;
  };
  const sub = (text) => {
    sh.label(`B${r}`, text, { bold: true, fill: P.total, color: P.navy });
    for (let c = 3; c <= 8; c++)
      sh.put(`${colLetter(c)}${r}`, null, null, { fill: P.total });
    r++;
  };
  sub("ESTADO DE RESULTADOS (base vertical: ventas netas)");
  for (const [key, label] of INCOME)
    line(
      label,
      ef.inc(key, "Ant"),
      ef.inc(key, "Act"),
      "Ventas",
      SUBTOTALS.includes(key),
    );
  sub("BALANCE GENERAL (base vertical: activo total)");
  for (const a of data.accounts) {
    const sign = a.id === "accDep" ? "-" : "";
    line(
      a.id === "accDep" ? "(−) Depreciación acumulada" : a.label,
      sign + ef.acc(a.id, "Ant"),
      sign + ef.acc(a.id, "Act"),
      "Activo_Total",
    );
  }
  line(
    "TOTAL ACTIVO",
    "Activo_Total_Ant",
    "Activo_Total_Act",
    "Activo_Total",
    true,
  );
  line(
    "TOTAL PASIVO",
    "Pasivo_Total_Ant",
    "Pasivo_Total_Act",
    "Activo_Total",
    true,
  );
  line(
    "TOTAL PATRIMONIO",
    "Patrimonio_Ant",
    "Patrimonio_Act",
    "Activo_Total",
    true,
  );
  // Barras de datos en «Variación %»: verdes si aumenta, rojas si disminuye.
  sh.ws.addConditionalFormatting({
    ref: `H${first}:H${r - 1}`,
    rules: [dataBar("FF3D8B6A", "FFB25555")],
  });

  // 2. Datos de cálculo
  r += 1;
  sh.bar(r++, "🔹  2. DATOS DE CÁLCULO (PROMEDIOS)");
  sh.header(r, ["Concepto", "Valor", "", "Fórmula"], 2);
  sh.merge(r, 5, 9);
  r++;
  const avg = (name) =>
    `IF(Usar_Promedios=1,(${name}_Act+${name}_Ant)/2,${name}_Act)`;
  const helper = (name, label, formula, f, text) => {
    sh.label(`B${r}`, label);
    sh.put(`C${r}`, fx(formula), f, { name, desc: label });
    sh.merge(r, 5, 9);
    sh.muted(`E${r}`, text);
    r++;
  };
  helper(
    "Dias_Periodo",
    "Días del período",
    "365*Meses_Act/12",
    "days",
    "365 × meses ÷ 12",
  );
  helper(
    "Activo_Promedio",
    "Activo total promedio",
    avg("Activo_Total"),
    "money",
    "(Activo actual + base) ÷ 2, o saldo de cierre si no se promedia",
  );
  helper(
    "Patrimonio_Promedio",
    "Patrimonio promedio",
    avg("Patrimonio"),
    "money",
    "(Patrimonio actual + base) ÷ 2",
  );
  helper(
    "Activo_Fijo_Promedio",
    "Activo fijo neto promedio",
    avg("Activo_Fijo_Neto"),
    "money",
    "(Activo fijo actual + base) ÷ 2",
  );
  helper(
    "Inventario_Promedio",
    "Inventario promedio",
    avg("Inventario"),
    "money",
    "(Inventario actual + base) ÷ 2",
  );
  helper(
    "CxC_Promedio",
    "Cuentas por cobrar promedio",
    avg("CxC"),
    "money",
    "(CxC actual + base) ÷ 2",
  );
  helper(
    "CxP_Promedio",
    "Cuentas por pagar promedio",
    avg("CxP"),
    "money",
    "(CxP actual + base) ÷ 2",
  );
  helper(
    "Ventas_Credito",
    "Ventas a crédito",
    "Ventas_Act*Pct_Ventas_Credito_Act/100",
    "money",
    "Ventas × % a crédito",
  );

  // 3. Razones
  const ratioHeader = (labels) => {
    sh.header(r, labels, 2);
    sh.merge(r, 5, 7);
    sh.merge(r, 8, 9);
    r++;
  };
  const ratioRow = (name, label, formula, text, f, th, interp, strong) => {
    const fill = strong ? P.okFill : undefined;
    sh.label(`B${r}`, label, { bold: strong, fill });
    sh.put(`C${r}`, fx(formula), f, {
      name,
      desc: label,
      bold: true,
      color: P.blue2,
      fill,
    });
    sh.put(
      `D${r}`,
      th ? fx(semaforo(`C${r}`, th)) : "Comparar con el sector",
      null,
      { size: 10 },
    );
    if (th)
      sh.ws.addConditionalFormatting({
        ref: `C${r}`,
        rules: [trafficLights(th)],
      });
    sh.merge(r, 5, 7);
    sh.muted(`E${r}`, text, { italic: false, size: 10 });
    sh.merge(r, 8, 9);
    sh.muted(`H${r}`, interp);
    sh.ws.getRow(r).height = 30;
    r++;
  };
  r += 1;
  sh.bar(r++, "🔹  3. RAZONES FINANCIERAS");
  ratioHeader([
    "Indicador",
    "Resultado",
    "Semáforo",
    "Fórmula",
    "",
    "",
    "Interpretación",
  ]);
  for (const def of RATIOS) {
    if (def.length === 1) {
      sh.label(`B${r}`, def[0], { bold: true, fill: P.total, color: P.navy });
      for (let c = 3; c <= 9; c++)
        sh.put(`${colLetter(c)}${r}`, null, null, { fill: P.total });
      r++;
    } else ratioRow(...def);
  }

  // 4. DuPont
  r += 1;
  sh.bar(
    r++,
    "🔹  4. SISTEMA DUPONT · ROE = Margen neto × Rotación de activos × Multiplicador del capital",
  );
  ratioHeader([
    "Factor",
    "Resultado",
    "Semáforo",
    "Fórmula",
    "",
    "",
    "Lectura",
  ]);
  ratioRow(
    null,
    "Margen neto",
    "Margen_Neto",
    "Utilidad neta ÷ Ventas",
    "pct",
    null,
    "Cuánto se gana por cada C$ vendido.",
  );
  ratioRow(
    null,
    "× Rotación de activos",
    "Rotacion_Activos",
    "Ventas ÷ Activo promedio",
    "times",
    null,
    "Cuánto venden los activos.",
  );
  ratioRow(
    "Multiplicador_Capital",
    "× Multiplicador del capital",
    nd("Activo_Promedio/Patrimonio_Promedio"),
    "Activo promedio ÷ Patrimonio promedio",
    "times",
    null,
    "Cuánto financiamiento respalda al patrimonio.",
  );
  ratioRow(
    "ROE_DuPont",
    "= ROE DuPont",
    nd("Margen_Neto*Rotacion_Activos*Multiplicador_Capital"),
    "Margen × Rotación × Multiplicador",
    "pct",
    [0, 0.1],
    "Debe coincidir con el ROE directo.",
    true,
  );
  sh.freeze(2, 3);
}

/* ───────────────────────── 04_Equilibrio ───────────────────────── */

function buildEquilibrio(book, ctx) {
  const c = book.data.cvu;
  const linked = c.linked && book.has("estados");
  const sh = new Sheet(book, "equilibrio", {
    title: "🎯  PUNTO DE EQUILIBRIO Y C-V-U",
    subtitle: linked
      ? `Vinculado a ${ctx.cur.label}: costo de ventas = costo variable; gastos operativos + depreciación = costos fijos`
      : "Costo-Volumen-Utilidad con supuestos manuales · Escribe en las celdas amarillas",
    widths: [3, 44, 18, 18, 42, 3, 14, 16, 16],
  });
  const S = ["Base", "Esc"];
  const per = (label, f, name, cell, o = {}) => ({
    label,
    fmt: f,
    name: name ? (i) => `${name}_${S[i]}` : undefined,
    cell,
    ...o,
  });
  const linkOr = (formula, key) =>
    linked ? fx(formula) : inp(inputValue(c[key]));
  const items = [
    { kind: "header", headers: ["Base", "Escenario", "Cómo se calcula"] },
    { kind: "section", label: "📥  DATOS DE OPERACIÓN" },
    per(
      "Unidades vendidas",
      "units",
      "Unidades",
      (col, i) =>
        i
          ? fx(`IF(Esc_Unidades="",Unidades_Base,Esc_Unidades)`)
          : inp(inputValue(c.units)),
      {
        note: "Escenario: unidades del escenario o, si está vacío, las de la base",
      },
    ),
    per(
      "Precio unitario",
      "money",
      "Precio",
      (col, i) =>
        i
          ? fx(nd("Precio_Base*(1+Esc_Cambio_Precio/100)"))
          : linkOr(nd("Ventas_Act/Unidades_Base"), "price"),
      { note: linked ? "Ventas del estado ÷ unidades" : "" },
    ),
    per(
      "Costo variable unitario",
      "money",
      "CV_Unitario",
      (col, i) =>
        i
          ? fx(nd("CV_Unitario_Base*(1+Esc_Cambio_CV/100)"))
          : linkOr(nd("Costo_Ventas_Act/Unidades_Base"), "variable"),
      { note: linked ? "Costo de ventas ÷ unidades" : "" },
    ),
    per(
      "Costos fijos operativos",
      "money",
      "Costos_Fijos",
      (col, i) =>
        i
          ? fx(nd("Costos_Fijos_Base*(1+Esc_Cambio_CF/100)"))
          : linkOr("Gastos_Operativos_Act+Depreciacion_Act", "fixed"),
      { note: linked ? "Gastos operativos + depreciación" : "" },
    ),
    per("Intereses", "money", "Intereses", (col, i) =>
      i ? fx("Intereses_Base") : linkOr("Intereses_Act", "interest"),
    ),
    per("Tasa de impuesto (%)", "rate", "Tasa", (col, i) =>
      i ? fx("Tasa_Base") : linkOr("Tasa_ISR_Act", "taxRate"),
    ),
    per("Dividendos preferentes (DP)", "money", "DP", (col, i) =>
      i ? fx("DP_Base") : inp(inputValue(c.dividends)),
    ),
    per("Acciones comunes", "units", "Acciones", (col, i) =>
      i ? fx("Acciones_Base") : inp(inputValue(c.shares)),
    ),
    {
      kind: "section",
      label: "🧪  PARÁMETROS DEL ESCENARIO (columna Base)",
      fill: P.blue2,
    },
    ...[
      [
        "Esc_Unidades",
        "Unidades del escenario (vacío = base)",
        "units",
        c.scenarioUnits,
      ],
      ["Esc_Cambio_Precio", "Cambio en precio (%)", "rate", c.priceChange],
      [
        "Esc_Cambio_CV",
        "Cambio en costo variable unitario (%)",
        "rate",
        c.costChange,
      ],
      ["Esc_Cambio_CF", "Cambio en costos fijos (%)", "rate", c.fixedChange],
      ["Utilidad_Deseada", "Utilidad operativa deseada (C$)", "money", ""],
    ].map(([name, label, f, v]) => ({
      label,
      fmt: f,
      name: (i) => (i ? undefined : name),
      cell: (col, i) => (i ? null : inp(inputValue(v))),
    })),
    { kind: "section", label: "📊  RESULTADOS CLAVE", fill: P.blue2 },
    per(
      "Margen de contribución unitario",
      "money",
      "MC_Unitario",
      (col, i) => fx(nd(`Precio_${S[i]}-CV_Unitario_${S[i]}`)),
      { note: "Precio − Costo variable unitario" },
    ),
    per(
      "Margen de contribución (%)",
      "pct",
      "MC_Porcentaje",
      (col, i) => fx(nd(`MC_Unitario_${S[i]}/Precio_${S[i]}`)),
      { note: "MC unitario ÷ Precio" },
    ),
    per(
      "🎯 PUNTO DE EQUILIBRIO (unidades)",
      "units",
      "PE_Unidades",
      (col, i) =>
        fx(
          nd(
            `IF(MC_Unitario_${S[i]}>0,Costos_Fijos_${S[i]}/MC_Unitario_${S[i]},"N/D")`,
          ),
        ),
      { kind: "key", note: "Costos fijos ÷ MC unitario" },
    ),
    per(
      "🎯 PUNTO DE EQUILIBRIO (C$)",
      "money",
      "PE_Ventas",
      (col, i) => fx(nd(`PE_Unidades_${S[i]}*Precio_${S[i]}`)),
      { kind: "key", note: "PE unidades × Precio = CF ÷ MC %" },
    ),
    per(
      "Unidades para la utilidad deseada",
      "units",
      "Unidades_Meta",
      (col, i) =>
        fx(
          nd(
            `IF(MC_Unitario_${S[i]}>0,(Costos_Fijos_${S[i]}+Utilidad_Deseada)/MC_Unitario_${S[i]},"N/D")`,
          ),
        ),
      { note: "(Costos fijos + Utilidad deseada) ÷ MC unitario" },
    ),
    per(
      "Margen de seguridad",
      "pct",
      "Margen_Seguridad",
      (col, i) =>
        fx(nd(`(Unidades_${S[i]}-PE_Unidades_${S[i]})/Unidades_${S[i]}`)),
      { note: "(Unidades − PE) ÷ Unidades" },
    ),
    { kind: "section", label: "📄  ESTADO DE RESULTADOS C-V-U", fill: P.blue2 },
    per(
      "Ventas",
      "money",
      "Ventas_CVU",
      (col, i) => fx(nd(`Unidades_${S[i]}*Precio_${S[i]}`)),
      { note: "Precio × Unidades" },
    ),
    per(
      "(−) Costo variable total",
      "money",
      "CV_Total",
      (col, i) => fx(nd(`Unidades_${S[i]}*CV_Unitario_${S[i]}`)),
      { note: "Costo variable × Unidades" },
    ),
    per(
      "MARGEN DE CONTRIBUCIÓN TOTAL",
      "money",
      "MC_Total",
      (col, i) => fx(nd(`Ventas_CVU_${S[i]}-CV_Total_${S[i]}`)),
      { kind: "total", note: "Ventas − Costo variable" },
    ),
    per("(−) Costos fijos", "money", null, (col, i) =>
      fx(`Costos_Fijos_${S[i]}`),
    ),
    per(
      "UTILIDAD OPERATIVA (UAII)",
      "money",
      "UAII_CVU",
      (col, i) => fx(nd(`MC_Total_${S[i]}-Costos_Fijos_${S[i]}`)),
      { kind: "total", note: "Margen de contribución − Costos fijos" },
    ),
  ];
  layout(items, 5);
  writeTable(sh, items, ["C", "D"], { noteCol: "E" });

  // Datos de la gráfica de equilibrio (G:I): de 0 a 2 × punto de equilibrio.
  sh.header(5, ["Unidades", "Ingresos", "Costos totales"], 7, P.blue2);
  for (let k = 0; k <= 10; k++) {
    const r = 6 + k;
    sh.put(`G${r}`, fx(`Grafica_Unidades_Max*${k}/10`), "units", { size: 9 });
    sh.put(`H${r}`, fx(`IFERROR(G${r}*Precio_Base,0)`), "money0", { size: 9 });
    sh.put(
      `I${r}`,
      fx(`IFERROR(Costos_Fijos_Base+G${r}*CV_Unitario_Base,0)`),
      "money0",
      { size: 9 },
    );
  }
  sh.label("G17", "Escala máx.", { bold: true, size: 9 });
  sh.merge(17, 8, 9);
  sh.put(
    "H17",
    fx(
      `IFERROR(PE_Unidades_Base*2,MAX(1,IF(ISNUMBER(Unidades_Base),Unidades_Base,0)))`,
    ),
    "units",
    {
      name: "Grafica_Unidades_Max",
      desc: "Escala del eje X de la gráfica: 2 × punto de equilibrio",
      size: 9,
    },
  );
  book.chart("equilibrio", {
    col: 6,
    row: 18,
    width: 560,
    height: 320,
    spec: {
      type: "scatter",
      title: "Punto de equilibrio: ingresos vs costos totales",
      xTitle: "Unidades vendidas",
      yTitle: book.data.currency,
      series: [
        {
          nameRef: ref(sh.name, "H5"),
          x: ref(sh.name, "G6:G16"),
          y: ref(sh.name, "H6:H16"),
          color: hex(P.navy),
        },
        {
          nameRef: ref(sh.name, "I5"),
          x: ref(sh.name, "G6:G16"),
          y: ref(sh.name, "I6:I16"),
          color: hex(P.bad),
        },
      ],
    },
  });
  sh.freeze(2, 5);
}

/* ───────────────────────── 05_Apalancamiento ───────────────────────── */

function buildApalancamiento(book) {
  const sh = new Sheet(book, "apalancamiento", {
    title: "🔺  APALANCAMIENTO OPERATIVO, FINANCIERO Y TOTAL",
    subtitle:
      "GAO, GAF y GAT · Fórmulas directas (base) y por variaciones (escenario vs. base) · Datos de 04_Equilibrio",
    widths: [3, 44, 18, 18, 44, 3, 16, 14],
  });
  const S = ["Base", "Esc"];
  const per = (label, name, formula, o = {}) => ({
    label,
    fmt: "money",
    name: name ? (i) => `${name}_${S[i]}` : undefined,
    cell: (col, i) => fx(formula(S[i])),
    ...o,
  });
  const one = (label, name, formula, f, o = {}) => ({
    label,
    fmt: f,
    name: (i) => (i ? undefined : name),
    cell: (col, i) => (i ? null : fx(formula)),
    ...o,
  });
  const items = [
    { kind: "header", headers: ["Base", "Escenario", "Cómo se calcula"] },
    { kind: "section", label: "📊  ESTADO DE RESULTADOS HASTA LA UPA" },
    per("Ventas", null, (s) => `Ventas_CVU_${s}`),
    per("(−) Costos variables", null, (s) => `CV_Total_${s}`),
    per("MARGEN DE CONTRIBUCIÓN", null, (s) => `MC_Total_${s}`, {
      kind: "total",
    }),
    per("(−) Costos fijos", null, (s) => `Costos_Fijos_${s}`),
    per("UTILIDAD OPERATIVA (UAII)", null, (s) => `UAII_CVU_${s}`, {
      kind: "total",
    }),
    per("(−) Intereses", null, (s) => `Intereses_${s}`),
    per(
      "UTILIDAD ANTES DE IMPUESTOS (UAI)",
      "UAI_CVU",
      (s) => nd(`UAII_CVU_${s}-Intereses_${s}`),
      { kind: "total", note: "UAII − Intereses" },
    ),
    per(
      "(−) Impuestos",
      "Impuestos_CVU",
      (s) => nd(`MAX(0,UAI_CVU_${s})*Tasa_${s}/100`),
      { note: "Sin crédito fiscal en pérdidas" },
    ),
    per(
      "UTILIDAD NETA",
      "UN_CVU",
      (s) => nd(`UAI_CVU_${s}-Impuestos_CVU_${s}`),
      { kind: "total" },
    ),
    per("(−) Dividendos preferentes", null, (s) => `DP_${s}`),
    per(
      "UTILIDAD POR ACCIÓN (UPA)",
      "UPA",
      (s) => nd(`(UN_CVU_${s}-DP_${s})/Acciones_${s}`),
      { kind: "key", note: "(Utilidad neta − DP) ÷ Acciones comunes" },
    ),
    {
      kind: "section",
      label: "🎯  GRADOS DE APALANCAMIENTO · MÉTODO DIRECTO (columna Base)",
      fill: P.blue2,
    },
    one(
      "GAO · Apalancamiento operativo",
      "GAO_Base",
      nd("MC_Total_Base/UAII_CVU_Base"),
      "times",
      { note: "MC ÷ UAII · 1% en ventas → GAO% en UAII" },
    ),
    one(
      "GAF · Apalancamiento financiero",
      "GAF_Base",
      nd(
        "UAII_CVU_Base/(UAII_CVU_Base-Intereses_Base-DP_Base/(1-Tasa_Base/100))",
      ),
      "times",
      { note: "UAII ÷ [UAII − I − DP ÷ (1 − T)]" },
    ),
    one(
      "GAT · Apalancamiento total",
      "GAT_Base",
      nd("GAO_Base*GAF_Base"),
      "times",
      { kind: "key", note: "GAO × GAF · 1% en ventas → GAT% en UPA" },
    ),
    {
      kind: "section",
      label: "📈  MÉTODO DE VARIACIONES (escenario vs. base)",
      fill: P.blue2,
    },
    one(
      "Cambio en ventas",
      "Cambio_Ventas",
      nd("(Ventas_CVU_Esc-Ventas_CVU_Base)/Ventas_CVU_Base"),
      "pct",
      { note: "(Escenario − Base) ÷ Base" },
    ),
    one(
      "Cambio en UAII",
      "Cambio_UAII",
      nd("(UAII_CVU_Esc-UAII_CVU_Base)/UAII_CVU_Base"),
      "pct",
      { note: "(Escenario − Base) ÷ Base" },
    ),
    one(
      "Cambio en UPA",
      "Cambio_UPA",
      nd("(UPA_Esc-UPA_Base)/UPA_Base"),
      "pct",
      { note: "(Escenario − Base) ÷ Base" },
    ),
    one(
      "GAO por variaciones",
      "GAO_Variaciones",
      nd("Cambio_UAII/Cambio_Ventas"),
      "times",
      { note: "%Δ UAII ÷ %Δ Ventas" },
    ),
    one(
      "GAF por variaciones",
      "GAF_Variaciones",
      nd("Cambio_UPA/Cambio_UAII"),
      "times",
      { note: "%Δ UPA ÷ %Δ UAII" },
    ),
    one(
      "GAT por variaciones",
      "GAT_Variaciones",
      nd("Cambio_UPA/Cambio_Ventas"),
      "times",
      { note: "%Δ UPA ÷ %Δ Ventas" },
    ),
  ];
  layout(items, 5);
  writeTable(sh, items, ["C", "D"], { noteCol: "E" });
  sh.header(5, ["Indicador", "Valor"], 7, P.blue2);
  [
    ["GAO", "GAO_Base"],
    ["GAF", "GAF_Base"],
    ["GAT", "GAT_Base"],
  ].forEach(([l, n], k) => {
    sh.label(`G${6 + k}`, l, { bold: true });
    sh.put(`H${6 + k}`, fx(`IF(ISNUMBER(${n}),${n},0)`), "times");
  });
  book.chart("apalancamiento", {
    col: 6,
    row: 10,
    width: 440,
    height: 280,
    spec: {
      type: "bar",
      title: "Grados de apalancamiento",
      fmt: '0.00"x"',
      legend: false,
      series: [
        {
          name: "Grado",
          cat: ref(sh.name, "G6:G8"),
          val: ref(sh.name, "H6:H8"),
          color: hex(P.blue),
        },
      ],
    },
  });
  sh.freeze(2, 5);
}

/* ───────────────────────── 06_Flujo ───────────────────────── */

const GROUP_LABEL = {
  operating: "Operación",
  investing: "Inversión",
  financing: "Financiamiento",
};
const FE_NAMES = {
  operating: "FE_Operacion",
  investing: "FE_Inversion",
  financing: "FE_Financiamiento",
};

function buildFlujo(book, ctx, ef) {
  const { data } = book;
  const { cur, prev } = ctx;
  const linked = Boolean(data.flow.linked && prev);
  const sh = new Sheet(book, "flujo", {
    title: "💵  FLUJO DE EFECTIVO",
    subtitle: linked
      ? `Vinculado: ${prev.label} → ${cur.label}. Cada línea se calcula con el balance y el estado de resultados de 02_Estados`
      : `${cur.label} · Movimientos registrados: agrega filas en la tabla y los totales se recalculan con SUMIF`,
    widths: linked
      ? [3, 62, 18, 54, 3, 18, 16]
      : [3, 40, 18, 14, 18, 18, 3, 18, 16],
  });
  const chartCol = linked ? 6 : 8; // columna (1-based) de la tabla de la gráfica
  let R;
  const items = [];
  if (linked) {
    const spec = linkedFlowSpec(data.accounts);
    const defaults = new Set(defaultAccounts.map((a) => a.id));
    const delta = (a, b) => `(${a}-${b})`;
    const term = ([type, key, sign]) => {
      const body =
        type === "inc"
          ? ef.inc(key, "Act")
          : type === "acc"
            ? delta(ef.acc(key, "Act"), ef.acc(key, "Ant"))
            : type === "grp"
              ? delta(ef.grp(key, "Act"), ef.grp(key, "Ant"))
              : `(${
                  data.accounts
                    .filter((a) => a.group === key && !defaults.has(a.id))
                    .map((a) => delta(ef.acc(a.id, "Act"), ef.acc(a.id, "Ant")))
                    .join("+") || "0"
                })`;
      return `${sign < 0 ? "-" : "+"}${body}`;
    };
    const formula = (terms) => terms.map(term).join("").replace(/^\+/, "");
    const describe = (terms) =>
      terms
        .map(([type, key, sign], i) => {
          const name =
            type === "inc"
              ? INCOME.find(([k]) => k === key)[1].replace(/^\([−±+]\)\s*/, "")
              : type === "acc"
                ? `Δ ${data.accounts.find((a) => a.id === key)?.label ?? key}`
                : type === "grp"
                  ? `Δ ${accountGroups[key]}`
                  : `Δ cuentas adicionales (${accountGroups[key].toLowerCase()})`;
          return `${sign < 0 ? "− " : i ? "+ " : ""}${name}`;
        })
        .join(" ");
    const range = (prefix, lines) =>
      `SUM(C${R[`${prefix}:${lines[0].key}`]}:C${R[`${prefix}:${lines.at(-1).key}`]})`;
    items.push({ kind: "header", headers: [data.currency, "Cómo se calcula"] });
    for (const g of ["operating", "investing", "financing"]) {
      items.push({
        kind: "section",
        label: `ACTIVIDADES DE ${GROUP_LABEL[g].toUpperCase()}`,
      });
      for (const l of spec[g])
        items.push({
          key: `${g}:${l.key}`,
          label: l.label,
          fmt: "money",
          indent: 1,
          note: describe(l.terms),
          cell: () => fx(formula(l.terms)),
        });
      items.push({
        key: g,
        kind: "key",
        label: `Flujo de ${GROUP_LABEL[g].toLowerCase()}`,
        fmt: "money",
        name: () => FE_NAMES[g],
        cell: () => fx(range(g, spec[g])),
      });
    }
    items.push(
      { kind: "section", label: "📊  RESUMEN", fill: P.blue2 },
      {
        label: `Efectivo inicial (balance de ${prev.label})`,
        fmt: "money",
        name: () => "Efectivo_Inicial",
        cell: () => fx("Efectivo_Ant"),
      },
      {
        label: "Variación neta de efectivo",
        fmt: "money",
        name: () => "Variacion_Neta_Efectivo",
        cell: () => fx("FE_Operacion+FE_Inversion+FE_Financiamiento"),
        note: "Operación + Inversión + Financiamiento",
      },
      {
        kind: "total",
        label: "EFECTIVO FINAL",
        fmt: "money",
        name: () => "Efectivo_Final",
        cell: () => fx("Efectivo_Inicial+Variacion_Neta_Efectivo"),
        note: "Efectivo inicial + Variación neta",
      },
      { kind: "section", label: "🔁  MÉTODO INDIRECTO", fill: P.blue2 },
      ...spec.indirect.map((l) => ({
        key: `ind:${l.key}`,
        label: l.label,
        fmt: "money",
        indent: 1,
        note: describe(l.terms),
        cell: () => fx(formula(l.terms)),
      })),
      {
        kind: "total",
        label: "Flujo de operación (indirecto)",
        fmt: "money",
        name: () => "FE_Operacion_Indirecto",
        cell: () => fx(range("ind", spec.indirect)),
      },
      { kind: "section", label: "🔎  CONCILIACIÓN", fill: P.blue2 },
      {
        label: `Efectivo en el balance de ${cur.label}`,
        fmt: "money",
        cell: () => fx("Efectivo_Act"),
      },
      {
        kind: "key",
        label:
          "Diferencia efectivo final − balance (0 si ambos balances cuadran)",
        fmt: "money",
        cell: () => fx("Efectivo_Final-Efectivo_Act"),
      },
      {
        label: "Diferencia operación directa − indirecta",
        fmt: "money",
        cell: () => fx("FE_Operacion-FE_Operacion_Indirecto"),
      },
    );
    ({ R } = layout(items, 5));
    writeTable(sh, items, ["C"], { noteCol: "D" });
  } else {
    // Tabla de movimientos (método directo manual).
    const settings = data.flow.settings?.[cur.id] || {};
    sh.header(5, [
      "Concepto",
      "Actividad",
      "Movimiento",
      `Importe ${data.currency}`,
      "Importe con signo",
    ]);
    const entries = data.flow.entries.filter((e) => e.periodId === cur.id);
    const first = 6;
    let r = first;
    for (let k = 0; k < entries.length + 10; k++, r++) {
      const e = entries[k];
      sh.put(`B${r}`, inp(e ? e.label || "Movimiento" : null), null, {
        align: "left",
      });
      sh.put(`C${r}`, inp(e ? GROUP_LABEL[e.group] : null));
      sh.put(
        `D${r}`,
        inp(e ? (e.direction === "out" ? "Salida" : "Entrada") : null),
      );
      sh.put(`E${r}`, inp(e ? inputValue(e.amount) : null), "money");
      sh.put(`F${r}`, fx(`IF(D${r}="Salida",-E${r},E${r})`), "money");
      sh.ws.getCell(`C${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Operación,Inversión,Financiamiento"'],
      };
      sh.ws.getCell(`D${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Entrada,Salida"'],
      };
    }
    const last = r - 1;
    const sumif = (label) =>
      `SUMIF($C$${first}:$C$${last},"${label}",$F$${first}:$F$${last})`;
    const delta = (id) => `(${ef.acc(id, "Act")}-${ef.acc(id, "Ant")})`;
    items.push(
      { kind: "section", label: "📊  RESUMEN · MÉTODO DIRECTO" },
      {
        label: prev
          ? `Efectivo inicial (balance de ${prev.label})`
          : "Efectivo inicial",
        fmt: "money",
        name: () => "Efectivo_Inicial",
        cell: () =>
          prev ? fx("Efectivo_Ant") : inp(inputValue(settings.initialCash)),
      },
      ...["operating", "investing", "financing"].map((g) => ({
        label: `Flujo de ${GROUP_LABEL[g].toLowerCase()}`,
        fmt: "money",
        name: () => FE_NAMES[g],
        cell: () => fx(sumif(GROUP_LABEL[g])),
      })),
      {
        label: "Variación neta de efectivo",
        fmt: "money",
        name: () => "Variacion_Neta_Efectivo",
        cell: () => fx("FE_Operacion+FE_Inversion+FE_Financiamiento"),
      },
      {
        kind: "total",
        label: "EFECTIVO FINAL",
        fmt: "money",
        name: () => "Efectivo_Final",
        cell: () => fx("Efectivo_Inicial+Variacion_Neta_Efectivo"),
      },
    );
    if (prev)
      items.push(
        { kind: "section", label: "🔁  MÉTODO INDIRECTO", fill: P.blue2 },
        {
          key: "iNet",
          label: "Utilidad neta",
          fmt: "money",
          cell: () => fx("Utilidad_Neta_Act"),
        },
        {
          label: "+ Depreciación",
          fmt: "money",
          cell: () => fx("Depreciacion_Act"),
        },
        {
          label: "− Variación de CxC",
          fmt: "money",
          cell: () => fx(`-${delta("receivables")}`),
        },
        {
          label: "− Variación de inventario",
          fmt: "money",
          cell: () => fx(`-${delta("inventory")}`),
        },
        {
          label: "− Variación de otros activos corrientes",
          fmt: "money",
          cell: () => fx(`-${delta("otherCurrent")}`),
        },
        {
          label: "+ Variación de proveedores",
          fmt: "money",
          cell: () => fx(delta("payables")),
        },
        {
          label: "+ Variación de impuestos por pagar",
          fmt: "money",
          cell: () => fx(delta("taxPayable")),
        },
        {
          label: "+ Variación de otros pasivos corrientes",
          fmt: "money",
          cell: () => fx(delta("otherDebt")),
        },
        {
          key: "iAdj",
          label: "± Otros ajustes",
          fmt: "money",
          cell: () => inp(inputValue(settings.adjustments)),
        },
        {
          kind: "total",
          label: "Flujo de operación (indirecto)",
          fmt: "money",
          name: () => "FE_Operacion_Indirecto",
          cell: () => fx(`SUM(C${R.iNet}:C${R.iAdj})`),
        },
      );
    items.push(
      { kind: "section", label: "🔎  CONCILIACIÓN", fill: P.blue2 },
      {
        label: `Efectivo en el balance de ${cur.label}`,
        fmt: "money",
        cell: () => fx("Efectivo_Act"),
      },
      {
        kind: "key",
        label: "Diferencia efectivo final − balance",
        fmt: "money",
        cell: () => fx("Efectivo_Final-Efectivo_Act"),
      },
      ...(prev
        ? [
            {
              label: "Diferencia operación directa − indirecta",
              fmt: "money",
              cell: () => fx("FE_Operacion-FE_Operacion_Indirecto"),
            },
          ]
        : []),
    );
    ({ R } = layout(items, last + 2));
    writeTable(sh, items, ["C"], { to: 6 });
  }
  // Tabla y gráfica de flujos por actividad.
  const cc = colLetter(chartCol),
    vc = colLetter(chartCol + 1);
  sh.header(5, ["Actividad", data.currency], chartCol, P.blue2);
  [
    ["Operación", "FE_Operacion"],
    ["Inversión", "FE_Inversion"],
    ["Financiamiento", "FE_Financiamiento"],
    ["Variación neta", "Variacion_Neta_Efectivo"],
  ].forEach(([l, n], k) => {
    sh.label(`${cc}${6 + k}`, l, { bold: true });
    sh.put(`${vc}${6 + k}`, fx(n), "money0");
  });
  book.chart("flujo", {
    col: chartCol - 1,
    row: 11,
    width: 460,
    height: 300,
    spec: {
      type: "bar",
      title: "Flujos por actividad",
      legend: false,
      series: [
        {
          name: "Flujo",
          cat: ref(sh.name, `${cc}6:${cc}9`),
          val: ref(sh.name, `${vc}6:${vc}9`),
          color: hex(P.blue),
        },
      ],
    },
  });
  sh.freeze(2, 5);
}

/* ───────────────────────── 07_Presupuestos ───────────────────────── */

function buildPresupuestos(book, ctx) {
  const { data } = book;
  const b = data.budget,
    linked = b.linked && book.has("estados");
  const M = b.months;
  const sh = new Sheet(book, "presupuestos", {
    title: "📅  PLANEACIÓN Y PRESUPUESTOS",
    subtitle: linked
      ? `Vinculado a ${ctx.cur.label} · Ventas, compras, resultados y caja · El crédito se cobra/paga al mes siguiente`
      : "Supuestos manuales · Ventas, compras, resultados y caja · El crédito se cobra/paga al mes siguiente",
    widths: [3, 48, ...M.map(() => 16), 18],
  });
  const cols = [...M.map((_, i) => colLetter(i + 3)), colLetter(M.length + 3)];
  const T = M.length;
  const sup = [
    [
      "Precio_Venta",
      "Precio de venta unitario",
      "money",
      () => inp(inputValue(b.price)),
    ],
    [
      "Costo_Unitario",
      "Costo unitario de compra",
      "money",
      () => inp(inputValue(b.cost)),
    ],
    [
      "Pct_Cobro_Mes",
      "Ventas cobradas en el mismo mes (%)",
      "rate",
      () => inp(inputValue(b.cashPct)),
    ],
    [
      "Pct_Pago_Mes",
      "Compras pagadas en el mismo mes (%)",
      "rate",
      () => inp(inputValue(b.payPct)),
    ],
    [
      "Tasa_ISR_Ppto",
      "Tasa de impuesto (%)",
      "rate",
      () => (linked ? fx("Tasa_ISR_Act") : inp(inputValue(b.taxRate))),
    ],
    [
      "Saldo_Minimo",
      "Saldo mínimo deseado de caja",
      "money",
      () => inp(inputValue(b.minimum)),
    ],
    [
      "Inv_Inicial_Unidades",
      "Inventario inicial (unidades)",
      "units",
      () =>
        linked
          ? fx("IFERROR(Inventario_Act/Costo_Unitario,0)")
          : inp(inputValue(b.initialUnits)),
    ],
    [
      "Caja_Inicial",
      "Saldo inicial de caja",
      "money",
      () => (linked ? fx("Efectivo_Act") : inp(inputValue(b.initialCash))),
    ],
    [
      "CxC_Inicial",
      "Cuentas por cobrar iniciales",
      "money",
      () => (linked ? fx("CxC_Act") : inp(inputValue(b.receivables))),
    ],
    [
      "CxP_Inicial",
      "Cuentas por pagar iniciales",
      "money",
      () => (linked ? fx("CxP_Act") : inp(inputValue(b.payables))),
    ],
    ...(linked
      ? [
          [
            "Meses_Base",
            "Meses del período base",
            "int",
            () => fx("MAX(1,Meses_Act)"),
          ],
          [
            "Unidades_Mes_Base",
            "Unidades mensuales del período base",
            "units",
            () => fx("IFERROR(Ventas_Act/Meses_Base/Precio_Venta,0)"),
          ],
        ]
      : []),
  ];
  let r = 5;
  sh.bar(r++, "📥  SUPUESTOS GENERALES", { to: 3 });
  for (const [name, label, f, cell] of sup) {
    sh.label(`B${r}`, label);
    sh.put(`C${r}`, cell(), f, { name, desc: label });
    r++;
  }
  r += 1;
  let R;
  const at = (k, c) => `${c}${R[k]}`;
  const prevCol = (i) => cols[i - 1];
  const monthly = (key, label, f, cell, total = "sum", kind) => ({
    key,
    label,
    fmt: f,
    kind,
    cell: (c, i) => {
      if (i === T) {
        if (!total) return null;
        if (total === "first") return fx(at(key, cols[0]));
        if (total === "last") return fx(at(key, cols[T - 1]));
        return fx(`SUM(${at(key, cols[0])}:${at(key, cols[T - 1])})`);
      }
      return cell(c, i);
    },
  });
  const mInput = (field) => (c, i) => inp(inputValue(M[i][field]));
  const linkedOr = (field, name) => (c, i) =>
    linked ? fx(`${name}_Act/Meses_Base`) : inp(inputValue(M[i][field]));
  const head = (label) => [
    { kind: "section", label },
    {
      kind: "header",
      headers: [...M.map((m, i) => m.label || `Mes ${i + 1}`), "Total / saldo"],
    },
  ];
  const items = [
    ...head("🗓️  SUPUESTOS MENSUALES"),
    ...(linked
      ? [
          monthly(
            "growth",
            "Crecimiento de unidades (%)",
            "rate",
            mInput("growth"),
            null,
          ),
        ]
      : []),
    monthly("units", "Unidades de venta", "units", (c, i) =>
      linked
        ? fx(
            `${i ? at("units", prevCol(i)) : "Unidades_Mes_Base"}*(1+${at("growth", c)}/100)`,
          )
        : inp(inputValue(M[i].units)),
    ),
    monthly(
      "desired",
      "Inventario final deseado (unidades)",
      "units",
      mInput("desired"),
      null,
    ),
    monthly(
      "expense",
      "Gastos desembolsables",
      "money",
      linkedOr("expense", "Gastos_Operativos"),
    ),
    monthly(
      "dep",
      "Depreciación",
      "money",
      linkedOr("depreciation", "Depreciacion"),
    ),
    monthly(
      "interest",
      "Intereses",
      "money",
      linkedOr("interest", "Intereses"),
    ),
    monthly("otherOut", "Otras salidas de caja", "money", mInput("otherOut")),
    monthly("otherIn", "Otras entradas de caja", "money", mInput("otherIn")),
    { kind: "blank" },
    ...head("📊  PRESUPUESTO DE VENTAS"),
    monthly(
      "sales",
      "Ventas (C$)",
      "money",
      (c) => fx(`${at("units", c)}*Precio_Venta`),
      "sum",
      "total",
    ),
    monthly(
      "arEnd",
      "Ventas a crédito pendientes de cobro",
      "money",
      (c) => fx(`${at("sales", c)}*(1-Pct_Cobro_Mes/100)`),
      "last",
    ),
    { kind: "blank" },
    ...head("📦  COMPRAS, INVENTARIOS Y COSTO DE VENTAS"),
    monthly(
      "openU",
      "Inventario inicial (unidades)",
      "units",
      (c, i) => fx(i ? at("closeU", prevCol(i)) : "Inv_Inicial_Unidades"),
      "first",
    ),
    monthly(
      "needU",
      "Necesidad: ventas + inventario deseado − inicial",
      "units",
      (c) => fx(`${at("units", c)}+${at("desired", c)}-${at("openU", c)}`),
      null,
    ),
    monthly("buyU", "Unidades a comprar", "units", (c) =>
      fx(`MAX(0,${at("needU", c)})`),
    ),
    monthly(
      "closeU",
      "Inventario final real (unidades)",
      "units",
      (c) => fx(`${at("openU", c)}+${at("buyU", c)}-${at("units", c)}`),
      "last",
    ),
    monthly(
      "purchases",
      "Compras (C$)",
      "money",
      (c) => fx(`${at("buyU", c)}*Costo_Unitario`),
      "sum",
      "total",
    ),
    monthly(
      "apEnd",
      "Compras a crédito pendientes de pago",
      "money",
      (c) => fx(`${at("purchases", c)}*(1-Pct_Pago_Mes/100)`),
      "last",
    ),
    monthly(
      "openV",
      "Inventario inicial valorado",
      "money",
      (c) => fx(`${at("openU", c)}*Costo_Unitario`),
      "first",
    ),
    monthly(
      "closeV",
      "Inventario final valorado",
      "money",
      (c) => fx(`${at("closeU", c)}*Costo_Unitario`),
      "last",
    ),
    monthly(
      "cogs",
      "Costo de ventas",
      "money",
      (c) => fx(`${at("openV", c)}+${at("purchases", c)}-${at("closeV", c)}`),
      "sum",
      "total",
    ),
    { kind: "blank" },
    ...head("📈  ESTADO DE RESULTADOS PROYECTADO"),
    monthly(
      "gross",
      "UTILIDAD BRUTA",
      "money",
      (c) => fx(`${at("sales", c)}-${at("cogs", c)}`),
      "sum",
      "total",
    ),
    monthly("ebit", "UAII", "money", (c) =>
      fx(`${at("gross", c)}-${at("expense", c)}-${at("dep", c)}`),
    ),
    monthly("ebt", "UAI", "money", (c) =>
      fx(`${at("ebit", c)}-${at("interest", c)}`),
    ),
    monthly("tax", "(−) Impuestos", "money", (c) =>
      fx(`MAX(0,${at("ebt", c)})*Tasa_ISR_Ppto/100`),
    ),
    monthly(
      "net",
      "UTILIDAD NETA",
      "money",
      (c) => fx(`${at("ebt", c)}-${at("tax", c)}`),
      "sum",
      "total",
    ),
    { kind: "blank" },
    ...head("💵  PRESUPUESTO DE CAJA"),
    monthly(
      "openCash",
      "Saldo inicial de caja",
      "money",
      (c, i) => fx(i ? at("closeCash", prevCol(i)) : "Caja_Inicial"),
      "first",
    ),
    monthly("curCol", "(+) Cobros de ventas del mes", "money", (c) =>
      fx(`${at("sales", c)}*Pct_Cobro_Mes/100`),
    ),
    monthly(
      "prevCol",
      "(+) Cobros de ventas del mes anterior",
      "money",
      (c, i) => fx(i ? at("arEnd", prevCol(i)) : "CxC_Inicial"),
    ),
    monthly(
      "collections",
      "Total cobros a clientes",
      "money",
      (c) => fx(`${at("curCol", c)}+${at("prevCol", c)}`),
      "sum",
      "total",
    ),
    monthly("cashIn", "(+) Otras entradas", "money", (c) =>
      fx(at("otherIn", c)),
    ),
    monthly("curPay", "(−) Pagos de compras del mes", "money", (c) =>
      fx(`${at("purchases", c)}*Pct_Pago_Mes/100`),
    ),
    monthly(
      "prevPay",
      "(−) Pagos de compras del mes anterior",
      "money",
      (c, i) => fx(i ? at("apEnd", prevCol(i)) : "CxP_Inicial"),
    ),
    monthly(
      "payments",
      "Total pagos a proveedores",
      "money",
      (c) => fx(`${at("curPay", c)}+${at("prevPay", c)}`),
      "sum",
      "total",
    ),
    monthly(
      "outTotal",
      "(−) Gastos, intereses, impuestos y otras salidas",
      "money",
      (c) =>
        fx(
          `${at("expense", c)}+${at("interest", c)}+${at("tax", c)}+${at("otherOut", c)}`,
        ),
    ),
    monthly(
      "closeCash",
      "SALDO FINAL DE CAJA",
      "money",
      (c) =>
        fx(
          `${at("openCash", c)}+${at("collections", c)}+${at("cashIn", c)}-${at("payments", c)}-${at("outTotal", c)}`,
        ),
      "last",
      "key",
    ),
    monthly(
      "minimum",
      "Saldo mínimo deseado",
      "money",
      () => fx("Saldo_Minimo"),
      null,
    ),
    monthly(
      "surplus",
      "Excedente / (faltante)",
      "money",
      (c) => fx(`${at("closeCash", c)}-${at("minimum", c)}`),
      null,
    ),
    monthly(
      "need",
      "Necesidad de financiamiento",
      "money",
      (c) => fx(`MAX(0,Saldo_Minimo-${at("closeCash", c)})`),
      null,
    ),
  ];
  ({ R } = layout(items, r));
  writeTable(sh, items, cols);
  sh.put(
    `${cols[T]}${R.closeCash}`,
    fx(at("closeCash", cols[T - 1])),
    "money",
    {
      name: "Caja_Final_Plan",
      desc: "Saldo final de caja del último mes del plan",
      bold: true,
      fill: P.okFill,
      color: P.navy,
    },
  );
  const months = `${cols[0]}${R.closeCash}:${cols[T - 1]}${R.closeCash}`;
  sh.ws.addConditionalFormatting({
    ref: months,
    rules: [dataBar("FF3F6FA3", "FFB25555")],
  });
  sh.ws.addConditionalFormatting({
    ref: `${cols[0]}${R.need}:${cols[T - 1]}${R.need}`,
    rules: [
      {
        type: "cellIs",
        operator: "greaterThan",
        formulae: ["0"],
        style: {
          font: { color: { argb: P.bad }, bold: true },
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: "FFFDECEA" },
          },
        },
      },
    ],
  });
  const headerRow = R.openCash - 1;
  const cats = ref(
    sh.name,
    `${cols[0]}${headerRow}:${cols[T - 1]}${headerRow}`,
  );
  book.chart("presupuestos", {
    col: 1,
    row: R.need + 1,
    width: 640,
    height: 300,
    spec: {
      type: "line",
      title: "Saldo final de caja vs saldo mínimo",
      series: [
        {
          nameRef: ref(sh.name, `B${R.closeCash}`),
          cat: cats,
          val: ref(sh.name, months),
          color: hex(P.navy),
        },
        {
          nameRef: ref(sh.name, `B${R.minimum}`),
          cat: cats,
          val: ref(
            sh.name,
            `${cols[0]}${R.minimum}:${cols[T - 1]}${R.minimum}`,
          ),
          color: hex(P.gold),
        },
      ],
    },
  });
  sh.freeze(2, 3);
}

/* ───────────────────────── 08_Proforma ───────────────────────── */

function buildProforma(book, ctx) {
  const { data } = book;
  const { cur, prev } = ctx;
  const config = data.proforma ?? {};
  // Mismos supuestos que el módulo de la app: lo capturado o, si está vacío,
  // la proporción real del período analizado.
  const pf = proforma(config, cur, prev, data.accounts);
  const sh = new Sheet(book, "proforma", {
    title: "📈  ESTADOS PROFORMA",
    subtitle: `Proyección del siguiente período a partir de ${cur.label} (porcentaje de ventas) y financiamiento externo requerido`,
    widths: [3, 46, 18, 18, 18, 44],
  });
  let r = 5;
  sh.bar(r++, "📥  SUPUESTOS DE PROYECCIÓN");
  sh.note(
    r++,
    "Supuestos del módulo de estados proforma. Los que no se capturaron usan la proporción real del período analizado. Cámbialos para simular otro escenario: todo se recalcula.",
  );
  const origin = {
    growth: "Sin dato: 0% (escribe el crecimiento esperado)",
    costPct: "Costo de ventas ÷ Ventas del período analizado",
    expensePct: "Gastos operativos ÷ Ventas",
    depreciation: "Depreciación del período analizado",
    interest: "Intereses del período analizado",
    taxRate: "Tasa del período analizado",
    payoutPct: prev
      ? "Utilidad neta − aumento de utilidades retenidas y reservas"
      : "Sin período base: 0%",
    arPct: "CxC ÷ Ventas",
    inventoryPct: "Inventario ÷ Costo de ventas",
    apPct: "CxP ÷ Costo de ventas",
    capex: prev
      ? "Δ activo fijo neto + depreciación del período"
      : "Sin período base: 0",
  };
  const NAMES = {
    growth: "PF_Crecimiento",
    costPct: "PF_Pct_Costo",
    expensePct: "PF_Pct_Gastos",
    depreciation: "PF_Depreciacion",
    interest: "PF_Intereses",
    taxRate: "PF_Tasa",
    payoutPct: "PF_Pct_Dividendos",
    arPct: "PF_Pct_CxC",
    inventoryPct: "PF_Pct_Inventario",
    apPct: "PF_Pct_CxP",
    capex: "PF_Compra_AF",
  };
  for (const [k, label, type] of proformaFields) {
    sh.label(`B${r}`, label);
    sh.put(`C${r}`, inp(pf.assumptions[k]), type, {
      name: NAMES[k],
      desc: label,
    });
    sh.merge(r, 4, 6);
    sh.muted(
      `D${r}`,
      hasValue(config[k]) ? "Supuesto capturado en el sistema" : origin[k],
    );
    r++;
  }
  r += 1;
  let R;
  const two = (label, act, pf, o = {}) => ({
    key: o.key,
    label,
    fmt: "money",
    kind: o.kind,
    name: (i) => (i === 1 ? o.name : undefined),
    cell: (c, i, row) =>
      i === 0 ? fx(act) : i === 1 ? fx(pf) : fx(`D${row}-C${row}`),
  });
  const total = (key, label, name, from, to) => ({
    key,
    label,
    fmt: "money",
    kind: "total",
    name: (i) => (i === 1 ? name : undefined),
    cell: (c, i, row) =>
      i < 2 ? fx(`SUM(${c}${R[from]}:${c}${R[to]})`) : fx(`D${row}-C${row}`),
  });
  const otherCurrent =
    "Activo_Corriente_Act-Efectivo_Act-Inversiones_Temporales_Act-CxC_Act-Inventario_Act";
  const items = [
    { kind: "section", label: "📊  ESTADO DE RESULTADOS PROFORMA" },
    {
      kind: "header",
      headers: [`Actual (${cur.label})`, "Proforma", "Variación"],
    },
    two("Ventas", "Ventas_Act", "Ventas_Act*(1+PF_Crecimiento/100)", {
      name: "PF_Ventas",
    }),
    two(
      "(−) Costo de ventas",
      "Costo_Ventas_Act",
      "PF_Ventas*PF_Pct_Costo/100",
      { name: "PF_Costo_Ventas" },
    ),
    two("UTILIDAD BRUTA", "Utilidad_Bruta_Act", "PF_Ventas-PF_Costo_Ventas", {
      name: "PF_Utilidad_Bruta",
      kind: "total",
    }),
    two(
      "(−) Gastos operativos",
      "Gastos_Operativos_Act",
      "PF_Ventas*PF_Pct_Gastos/100",
      { name: "PF_Gastos" },
    ),
    two("(−) Depreciación", "Depreciacion_Act", "PF_Depreciacion"),
    two(
      "UTILIDAD OPERATIVA (UAII)",
      "UAII_Act",
      "PF_Utilidad_Bruta-PF_Gastos-PF_Depreciacion",
      { name: "PF_UAII", kind: "total" },
    ),
    two(
      "(±) Otros ingresos netos (se mantienen)",
      "Otros_Ingresos_Act",
      "Otros_Ingresos_Act",
      { name: "PF_Otros_Ingresos" },
    ),
    two("(−) Intereses", "Intereses_Act", "PF_Intereses"),
    two(
      "UTILIDAD ANTES DE IMPUESTOS",
      "UAI_Act",
      "PF_UAII+PF_Otros_Ingresos-PF_Intereses",
      { name: "PF_UAI", kind: "total" },
    ),
    two("(−) Impuestos", "Impuestos_Act", "MAX(0,PF_UAI)*PF_Tasa/100", {
      name: "PF_Impuestos",
    }),
    two("UTILIDAD NETA", "Utilidad_Neta_Act", "PF_UAI-PF_Impuestos", {
      name: "PF_Utilidad_Neta",
      kind: "total",
    }),
    two(
      "Dividendos",
      `MAX(0,Utilidad_Neta_Act)*${pf.actual.payoutPct}/100`,
      "MAX(0,PF_Utilidad_Neta)*PF_Pct_Dividendos/100",
      {
        name: "PF_Dividendos",
      },
    ),
    { kind: "blank" },
    { kind: "section", label: "🏦  BALANCE GENERAL PROFORMA" },
    {
      kind: "header",
      headers: [`Actual (${cur.label})`, "Proforma", "Variación"],
    },
    two("Efectivo (se mantiene)", "Efectivo_Act", "Efectivo_Act", {
      key: "a0",
    }),
    two(
      "Inversiones temporales (se mantienen)",
      "Inversiones_Temporales_Act",
      "Inversiones_Temporales_Act",
    ),
    two("Cuentas por cobrar", "CxC_Act", "PF_Ventas*PF_Pct_CxC/100"),
    two(
      "Inventarios",
      "Inventario_Act",
      "PF_Costo_Ventas*PF_Pct_Inventario/100",
    ),
    two("Otros activos corrientes (se mantienen)", otherCurrent, otherCurrent),
    two(
      "Activo fijo neto",
      "Activo_Fijo_Neto_Act",
      "Activo_Fijo_Neto_Act+PF_Compra_AF-PF_Depreciacion",
    ),
    two(
      "Otros activos no corrientes (se mantienen)",
      "Total_Otros_ANC_Act",
      "Total_Otros_ANC_Act",
      { key: "a1" },
    ),
    total("assets", "TOTAL ACTIVO", "PF_Activo_Total", "a0", "a1"),
    two("Cuentas por pagar", "CxP_Act", "PF_Costo_Ventas*PF_Pct_CxP/100", {
      key: "l0",
    }),
    two(
      "Otros pasivos corrientes (se mantienen)",
      "Pasivo_Corriente_Act-CxP_Act",
      "Pasivo_Corriente_Act-CxP_Act",
    ),
    two(
      "Pasivo no corriente (se mantiene)",
      "Pasivo_No_Corriente_Act",
      "Pasivo_No_Corriente_Act",
    ),
    two(
      "Capital y reservas (se mantienen)",
      "Patrimonio_Act-Utilidades_Retenidas_Act",
      "Patrimonio_Act-Utilidades_Retenidas_Act",
    ),
    two(
      "Utilidades retenidas",
      "Utilidades_Retenidas_Act",
      "Utilidades_Retenidas_Act+PF_Utilidad_Neta-PF_Dividendos",
      { key: "l1" },
    ),
    total(
      "le",
      "TOTAL PASIVO + PATRIMONIO",
      "PF_Pasivo_Patrimonio",
      "l0",
      "l1",
    ),
    {
      label: "💡 FINANCIAMIENTO EXTERNO REQUERIDO (FER)",
      fmt: "money",
      kind: "key",
      name: (i) => (i === 1 ? "PF_FER" : undefined),
      cell: (c, i) =>
        i === 0
          ? fx(`C${R.assets}-C${R.le}`)
          : i === 1
            ? fx("PF_Activo_Total-PF_Pasivo_Patrimonio")
            : null,
    },
    {
      kind: "note",
      label:
        "FER = Activo total proforma − (Pasivo + Patrimonio proforma). Si FER > 0 se requiere financiamiento adicional; si FER < 0 hay excedente de fondos.",
    },
  ];
  ({ R } = layout(items, r));
  writeTable(sh, items, ["C", "D", "E"], { to: 6 });
  sh.freeze(2, 3);
}

/* ───────────────────────── 09_Personal ───────────────────────── */

function buildPersonal(book) {
  const { data } = book;
  const entries = data.personal || [];
  const sh = new Sheet(book, "personal", {
    title: "💼  PRESUPUESTO PERSONAL",
    subtitle:
      "Ingresos, gastos fijos y variables, saldo disponible y capacidad de ahorro",
    widths: [3, 34, 16, 18, 3, 26, 16],
  });
  const incomes = entries.filter((e) => e.kind === "income");
  const expenses = entries.filter((e) => e.kind !== "income");
  const totalRow = (r, label, formula, name) => {
    sh.label(`B${r}`, label, { bold: true, fill: P.total });
    sh.merge(r, 2, 3);
    sh.put(`D${r}`, fx(formula), "money", {
      name,
      desc: label,
      bold: true,
      fill: P.total,
      color: P.navy,
    });
  };
  let r = 5;
  sh.bar(r++, "💰  INGRESOS", { to: 4 });
  sh.header(r, ["Concepto", "", "Monto"]);
  sh.merge(r++, 2, 3);
  const i0 = r;
  for (let k = 0; k < incomes.length + 3; k++, r++) {
    const e = incomes[k];
    sh.put(`B${r}`, inp(e ? e.category.trim() || "Ingreso" : null), null, {
      align: "left",
    });
    sh.merge(r, 2, 3);
    sh.put(`D${r}`, inp(e ? inputValue(e.amount) : null), "money");
  }
  totalRow(r, "TOTAL INGRESOS", `SUM(D${i0}:D${r - 1})`, "Total_Ingresos");
  r += 2;
  sh.bar(r++, "💸  GASTOS", { to: 4 });
  sh.header(r++, ["Concepto", "Tipo", "Monto"]);
  const g0 = r;
  for (let k = 0; k < expenses.length + 5; k++, r++) {
    const e = expenses[k];
    sh.put(
      `B${r}`,
      inp(e ? e.category.trim() || "Sin categoría" : null),
      null,
      { align: "left" },
    );
    sh.put(`C${r}`, inp(e ? (e.kind === "fixed" ? "Fijo" : "Variable") : null));
    sh.ws.getCell(`C${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Fijo,Variable"'],
    };
    sh.put(`D${r}`, inp(e ? inputValue(e.amount) : null), "money");
  }
  const g1 = r - 1;
  totalRow(r, "TOTAL GASTOS", `SUM(D${g0}:D${g1})`, "Total_Gastos");
  r += 2;
  sh.bar(r++, "📊  RESULTADOS", { to: 4, fill: P.blue2 });
  const res = [
    [
      "Gastos_Fijos",
      "Gastos fijos",
      fx(`SUMIF(C${g0}:C${g1},"Fijo",D${g0}:D${g1})`),
      "money",
    ],
    [
      "Gastos_Variables",
      "Gastos variables",
      fx(`SUMIF(C${g0}:C${g1},"Variable",D${g0}:D${g1})`),
      "money",
    ],
    [
      "Saldo_Disponible",
      "Saldo disponible",
      fx("Total_Ingresos-Total_Gastos"),
      "money",
      "key",
    ],
    [
      "Capacidad_Ahorro",
      "Capacidad de ahorro",
      fx(nd("Saldo_Disponible/Total_Ingresos")),
      "pct",
      "key",
    ],
    ["Meta_Ahorro_Pct", "Meta de ahorro (%)", inp(20), "rate"],
    [
      "Meta_Ahorro",
      "Meta de ahorro (C$)",
      fx("Total_Ingresos*Meta_Ahorro_Pct/100"),
      "money",
    ],
    [
      null,
      "¿Cumple la meta?",
      fx(`IF(Saldo_Disponible>=Meta_Ahorro,"✅ Sí","❌ No")`),
      null,
    ],
  ];
  for (const [name, label, content, f, kind] of res) {
    const fill = kind === "key" ? P.okFill : undefined;
    sh.label(`B${r}`, label, { bold: !!kind, fill });
    sh.merge(r, 2, 3);
    sh.put(`D${r}`, content, f, {
      name,
      desc: label,
      bold: true,
      fill,
      color: P.navy,
    });
    r++;
  }
  // Gastos por concepto (datos de la gráfica).
  const cats = [
    ...new Set(expenses.map((e) => e.category.trim() || "Sin categoría")),
  ];
  if (!cats.length) cats.push("Sin gastos");
  sh.header(5, ["Concepto", "Monto"], 6, P.blue2);
  cats.forEach((cat, k) => {
    sh.label(`F${6 + k}`, cat);
    sh.put(
      `G${6 + k}`,
      fx(`SUMIF($B$${g0}:$B$${g1},F${6 + k},$D$${g0}:$D$${g1})`),
      "money0",
    );
  });
  const cEnd = 5 + cats.length;
  sh.muted(
    `F${cEnd + 1}`,
    "Si agregas un concepto nuevo, añádelo aquí para verlo en la gráfica.",
  );
  book.chart("personal", {
    col: 5,
    row: cEnd + 2,
    width: 420,
    height: 300,
    spec: {
      type: "doughnut",
      title: "Distribución de gastos",
      colors: [
        P.navy,
        P.blue,
        P.ok,
        P.gold,
        P.bad,
        "FF8666C9",
        "FF65A4ED",
        "FFA5B8D8",
        "FF2B4C78",
        "FF17A589",
      ].map(hex),
      series: [
        {
          name: "Gastos",
          cat: ref(sh.name, `F6:F${cEnd}`),
          val: ref(sh.name, `G6:G${cEnd}`),
        },
      ],
    },
  });
  sh.freeze(2, 3);
}

/* ───────────────────────── 10_Inventario ───────────────────────── */

function buildInventario(book) {
  const list = book.data.inventory || [];
  const sh = new Sheet(book, "inventario", {
    title: "📦  CONTROL DE INVENTARIO",
    subtitle:
      "Existencias, valor del inventario, stock mínimo y alertas de reposición",
    widths: [3, 28, 12, 12, 12, 14, 12, 14, 16, 14],
  });
  sh.header(5, [
    "Producto",
    "Inicial",
    "Entradas",
    "Salidas",
    "Costo unit.",
    "Stock mín.",
    "Existencia",
    `Valor ${book.data.currency}`,
    "Estado",
  ]);
  const first = 6;
  let r = first;
  for (let k = 0; k < list.length + 5; k++, r++) {
    const it = list[k];
    sh.put(`B${r}`, inp(it ? it.name || "Producto" : null), null, {
      align: "left",
    });
    ["initial", "incoming", "outgoing", "cost", "minimum"].forEach((f, j) =>
      sh.put(
        `${colLetter(3 + j)}${r}`,
        inp(it ? inputValue(it[f]) : null),
        f === "cost" ? "money" : "units",
      ),
    );
    sh.put(`H${r}`, fx(`C${r}+D${r}-E${r}`), "units", { bold: true });
    sh.put(`I${r}`, fx(`H${r}*F${r}`), "money");
    sh.put(
      `J${r}`,
      fx(
        `IF(B${r}="","",IF(H${r}<0,"⚠ Error",IF(H${r}<G${r},"🔴 Reponer","🟢 Normal")))`,
      ),
      null,
      { size: 10 },
    );
  }
  const last = r - 1;
  sh.label(`B${r}`, "TOTAL VALOR DEL INVENTARIO", {
    bold: true,
    fill: P.total,
  });
  sh.merge(r, 2, 8);
  sh.put(`I${r}`, fx(`SUM(I${first}:I${last})`), "money", {
    name: "Valor_Inventario",
    desc: "Valor total del inventario",
    bold: true,
    fill: P.total,
    color: P.navy,
  });
  sh.put(
    `J${r}`,
    fx(`COUNTIF(J${first}:J${last},"🔴 Reponer")&" por reponer"`),
    null,
    { bold: true, fill: P.total, size: 10 },
  );
  r += 2;
  sh.note(
    r,
    "Existencia = Inicial + Entradas − Salidas. Valor = Existencia × Costo unitario. Reponer cuando la existencia es menor que el stock mínimo.",
    { to: 10 },
  );
  const n = Math.max(1, list.length);
  const cat = ref(sh.name, `B${first}:B${first + n - 1}`);
  book.chart("inventario", {
    col: 1,
    row: r + 1,
    width: 640,
    height: 300,
    spec: {
      type: "bar",
      title: "Existencia final vs stock mínimo",
      series: [
        {
          nameRef: ref(sh.name, "H5"),
          cat,
          val: ref(sh.name, `H${first}:H${first + n - 1}`),
          color: hex(P.navy),
        },
        {
          nameRef: ref(sh.name, "G5"),
          cat,
          val: ref(sh.name, `G${first}:G${first + n - 1}`),
          color: hex(P.gold),
        },
      ],
    },
  });
  sh.freeze(2, 5);
}

/* ───────────────────────── 01_Panel ───────────────────────── */

function buildPanel(book, ctx) {
  const { data } = book;
  const sh = new Sheet(book, "panel", {
    title: "📊  PANEL FINANCIERO EJECUTIVO",
    subtitle: `${data.company || "Empresa sin nombre"} · Indicadores clave de ${ctx.cur.label} · Todo se recalcula desde las demás hojas`,
    widths: [3, 22, 18, 22, 18, 22, 18, 3],
  });
  const card = (row, col, label, formula, f) => {
    sh.merge(row, col, col + 1);
    sh.merge(row + 1, col, col + 1);
    const l = sh.ws.getRow(row).getCell(col);
    l.value = label;
    l.font = font({ bold: true, size: 10, color: P.white });
    l.fill = solid(P.blue);
    l.alignment = { horizontal: "center", vertical: "middle" };
    sh.put(`${colLetter(col)}${row + 1}`, fx(formula), f, {
      size: 18,
      bold: true,
      color: P.navy,
      fill: P.white,
    });
    sh.ws.getRow(row).height = 24;
    sh.ws.getRow(row + 1).height = 40;
  };
  card(5, 2, "VENTAS", "Ventas_Act", "money0");
  card(5, 4, "UTILIDAD NETA", "Utilidad_Neta_Act", "money0");
  card(5, 6, "MARGEN NETO", "Margen_Neto", "pct");
  card(8, 2, "ROE (DUPONT)", "ROE_DuPont", "pct");
  card(8, 4, "PUNTO DE EQUILIBRIO", "PE_Unidades_Base", "units0");
  card(8, 6, "GAT", "GAT_Base", "times");
  card(11, 2, "EFECTIVO FINAL (EFE)", "Efectivo_Final", "money0");
  card(11, 4, "CAJA AL CIERRE DEL PLAN", "Caja_Final_Plan", "money0");
  card(11, 6, "CAPITAL DE TRABAJO NETO", "Capital_Trabajo_Neto", "money0");

  sh.bar(14, "📈  EVOLUCIÓN DE VENTAS Y UTILIDAD");
  sh.header(15, [
    "Indicador",
    ctx.prev ? ctx.prev.label : "Base",
    ctx.cur.label,
  ]);
  [
    ["Ventas", "Ventas"],
    ["Utilidad neta", "Utilidad_Neta"],
  ].forEach(([l, n], k) => {
    sh.label(`B${16 + k}`, l, { bold: true });
    sh.put(`C${16 + k}`, fx(`${n}_Ant`), "money0");
    sh.put(`D${16 + k}`, fx(`${n}_Act`), "money0");
  });
  book.chart("panel", {
    col: 1,
    row: 18,
    width: 700,
    height: 300,
    spec: {
      type: "bar",
      title: "Ventas vs utilidad neta por período",
      series: [
        {
          nameRef: ref(sh.name, "B16"),
          cat: ref(sh.name, "C15:D15"),
          val: ref(sh.name, "C16:D16"),
          color: hex(P.navy),
        },
        {
          nameRef: ref(sh.name, "B17"),
          cat: ref(sh.name, "C15:D15"),
          val: ref(sh.name, "C17:D17"),
          color: hex(P.gold),
        },
      ],
    },
  });
  sh.bar(35, "🍩  ESTRUCTURA DE FINANCIAMIENTO");
  sh.header(36, ["Fuente", "Monto"]);
  [
    ["Pasivo corriente", "Pasivo_Corriente_Act"],
    ["Pasivo no corriente", "Pasivo_No_Corriente_Act"],
    ["Patrimonio", "Patrimonio_Act"],
  ].forEach(([l, n], k) => {
    sh.label(`B${37 + k}`, l, { bold: true });
    sh.put(`C${37 + k}`, fx(n), "money0");
  });
  book.chart("panel", {
    col: 3,
    row: 35,
    width: 420,
    height: 260,
    spec: {
      type: "doughnut",
      title: "Composición del financiamiento",
      colors: [hex(P.navy), hex(P.blue), hex(P.ok)],
      series: [
        {
          name: "Monto",
          cat: ref(sh.name, "B37:B39"),
          val: ref(sh.name, "C37:C39"),
        },
      ],
    },
  });
  sh.bar(50, "🚦  RAZONES CLAVE");
  sh.header(51, ["Indicador", "Valor", "Semáforo"]);
  [
    ["Razón corriente", "Razon_Corriente", "times", [1, 1.5]],
    ["Prueba ácida", "Prueba_Acida", "times", [0.8, 1]],
    ["Endeudamiento", "Razon_Endeudamiento", "pct", [0.5, 0.7, true]],
    ["Margen neto", "Margen_Neto", "pct", [0, 0.05]],
    ["ROE", "Rendimiento_Patrimonio", "pct", [0, 0.1]],
  ].forEach(([l, n, f, th], k) => {
    const r = 52 + k;
    sh.label(`B${r}`, l);
    sh.put(`C${r}`, fx(n), f, { bold: true, color: P.blue2 });
    sh.put(`D${r}`, fx(semaforo(`C${r}`, th)), null, { size: 10 });
    sh.ws.addConditionalFormatting({
      ref: `C${r}`,
      rules: [trafficLights(th)],
    });
  });
}

/* ───────────────────────── 00_Portada ───────────────────────── */

const NAV = {
  panel: ["📊  Panel principal", "Indicadores clave y gráficos generales"],
  estados: [
    "📑  Estados financieros",
    "Balance general y estado de resultados",
  ],
  analisis: [
    "📐  Análisis financiero",
    "Vertical, horizontal, razones y DuPont",
  ],
  equilibrio: [
    "🎯  Punto de equilibrio",
    "C-V-U, PE en unidades y C$, gráfica",
  ],
  apalancamiento: ["🔺  Apalancamiento", "GAO, GAF y GAT"],
  flujo: ["💵  Flujo de efectivo", "Operación, inversión y financiamiento"],
  presupuestos: [
    "📅  Planeación y presupuestos",
    "Ventas, compras, resultados y caja",
  ],
  proforma: ["📈  Estados proforma", "Proyección y financiamiento externo"],
  personal: ["💼  Presupuesto personal", "Ingresos, gastos y ahorro"],
  inventario: ["📦  Control de inventario", "Existencias y alertas"],
  formulas: [
    "📚  Fórmulas utilizadas",
    "Referencia de fórmulas y nombres definidos",
  ],
};

function buildPortada(book, ctx, spec) {
  const { data } = book;
  const sh = new Sheet(book, "portada", {
    title: "SISTEMA DE ANÁLISIS Y PLANEACIÓN FINANCIERA",
    subtitle:
      "Gestión Financiera Operativa · Libro generado por Finance Manager",
    widths: [3, 24, 22, 22, 22, 22, 22, 22],
  });
  sh.bar(5, "📋  IDENTIFICACIÓN DEL REPORTE");
  const info = [
    ["Empresa:", data.company || "Empresa sin nombre"],
    ["Contenido:", spec.label],
    [
      "Períodos analizados:",
      ctx.prev
        ? `${ctx.prev.label} (base) vs ${ctx.cur.label} (analizado)`
        : `${ctx.cur.label} (sin período base)`,
    ],
    ["Moneda:", data.currency === "$" ? "Dólares ($)" : "Córdobas (C$)"],
    [
      "Generado:",
      new Date().toLocaleString("es-NI", {
        dateStyle: "long",
        timeStyle: "short",
      }),
    ],
    ["Generado por:", "Finance Manager · exportación automática"],
  ];
  info.forEach(([l, v], k) => {
    const r = 6 + k;
    sh.label(`B${r}`, l, { bold: true });
    sh.merge(r, 3, 6);
    sh.put(`C${r}`, v, null, { align: "left", color: P.inFont });
  });
  sh.bar(13, "📖  ¿CÓMO USAR ESTE LIBRO?");
  [
    [
      "01",
      "Celdas amarillas",
      "Son datos de entrada. Vienen llenas con lo que capturaste en el sistema y puedes editarlas.",
    ],
    [
      "02",
      "Celdas blancas / grises",
      "Son fórmulas automáticas: no las edites, se recalculan solas.",
    ],
    [
      "03",
      "Nombres definidos",
      "Las fórmulas usan nombres legibles: Ventas_Act (período analizado), Ventas_Ant (período base). Consulta 11_Fórmulas.",
    ],
    [
      "04",
      "Semáforos",
      "🟢 Saludable · 🟡 Precaución · 🔴 Riesgo, según referencias académicas generales.",
    ],
    [
      "05",
      "Gráficos",
      "Se actualizan automáticamente cuando cambias los datos.",
    ],
    [
      "06",
      "Pestañas",
      "Cada pestaña corresponde a un módulo del sistema. Usa los enlaces de abajo para navegar.",
    ],
  ].forEach(([n, t, d], k) => {
    const r = 14 + k;
    sh.put(`B${r}`, n, null, {
      bold: true,
      size: 16,
      color: P.blue,
      fill: P.light,
    });
    sh.label(`C${r}`, t, { bold: true });
    sh.merge(r, 4, 8);
    sh.muted(`D${r}`, d, { size: 10, italic: false });
    sh.ws.getRow(r).height = 32;
  });
  sh.bar(21, "🧭  NAVEGACIÓN RÁPIDA");
  let r = 22;
  for (const key of spec.sheets) {
    if (!NAV[key]) continue;
    const [t, d] = NAV[key];
    sh.put(`B${r}`, fx(`HYPERLINK("#'${SHEET_NAMES[key]}'!A1","${t}")`), null, {
      bold: true,
      color: P.blue,
      align: "left",
      size: 10,
    });
    sh.merge(r, 3, 5);
    sh.muted(`C${r}`, d, { italic: false });
    r++;
  }
  sh.bar(
    r + 1,
    "Sistema de Gestión Financiera Operativa · Universidad Nacional de Ingeniería · 2026",
    { fill: P.navy, size: 9, bold: false, italic: true },
  );
}

/* ───────────────────────── 11_Fórmulas ───────────────────────── */

const FORMULAS = [
  [
    "analisis",
    "Variación horizontal",
    "(Analizado − Base) ÷ Base",
    '=IFERROR((D9-C9)/C9,"N/D")',
  ],
  [
    "analisis",
    "Vertical del estado de resultados",
    "Cuenta ÷ Ventas",
    '=IFERROR(D9/Ventas_Act,"N/D")',
  ],
  [
    "analisis",
    "Vertical del balance general",
    "Cuenta ÷ Activo total",
    '=IFERROR(D9/Activo_Total_Act,"N/D")',
  ],
  [
    "analisis",
    "Capital de trabajo neto",
    "Activo corriente − Pasivo corriente",
    "=Activo_Corriente_Act-Pasivo_Corriente_Act",
  ],
  [
    "analisis",
    "Razón corriente",
    "Activo corriente ÷ Pasivo corriente",
    '=IFERROR(Activo_Corriente_Act/Pasivo_Corriente_Act,"N/D")',
  ],
  [
    "analisis",
    "Prueba ácida",
    "(AC − Inventarios) ÷ PC",
    '=IFERROR((Activo_Corriente_Act-Inventario_Act)/Pasivo_Corriente_Act,"N/D")',
  ],
  [
    "analisis",
    "Rotación de inventario",
    "Costo de ventas ÷ Inventario promedio",
    '=IFERROR(Costo_Ventas_Act/Inventario_Promedio,"N/D")',
  ],
  [
    "analisis",
    "Período promedio de cobro",
    "Días ÷ Rotación de CxC",
    '=IFERROR(Dias_Periodo/Rotacion_CxC,"N/D")',
  ],
  [
    "analisis",
    "Razón de endeudamiento",
    "Pasivo total ÷ Activo total",
    '=IFERROR(Pasivo_Total_Act/Activo_Total_Act,"N/D")',
  ],
  [
    "analisis",
    "Margen neto",
    "Utilidad neta ÷ Ventas",
    '=IFERROR(Utilidad_Neta_Act/Ventas_Act,"N/D")',
  ],
  [
    "analisis",
    "ROA",
    "Utilidad neta ÷ Activo promedio",
    '=IFERROR(Utilidad_Neta_Act/Activo_Promedio,"N/D")',
  ],
  [
    "analisis",
    "ROE",
    "Utilidad neta ÷ Patrimonio promedio",
    '=IFERROR(Utilidad_Neta_Act/Patrimonio_Promedio,"N/D")',
  ],
  [
    "analisis",
    "ROE (DuPont)",
    "Margen × Rotación × Multiplicador",
    '=IFERROR(Margen_Neto*Rotacion_Activos*Multiplicador_Capital,"N/D")',
  ],
  [
    "equilibrio",
    "Margen de contribución",
    "Precio − Costo variable unitario",
    '=IFERROR(Precio_Base-CV_Unitario_Base,"N/D")',
  ],
  [
    "equilibrio",
    "Punto de equilibrio (unidades)",
    "Costos fijos ÷ MC unitario",
    '=IFERROR(IF(MC_Unitario_Base>0,Costos_Fijos_Base/MC_Unitario_Base,"N/D"),"N/D")',
  ],
  [
    "equilibrio",
    "Punto de equilibrio (C$)",
    "PE unidades × Precio",
    '=IFERROR(PE_Unidades_Base*Precio_Base,"N/D")',
  ],
  [
    "equilibrio",
    "Margen de seguridad",
    "(Unidades − PE) ÷ Unidades",
    '=IFERROR((Unidades_Base-PE_Unidades_Base)/Unidades_Base,"N/D")',
  ],
  [
    "equilibrio",
    "Unidades para utilidad deseada",
    "(CF + Utilidad deseada) ÷ MC unitario",
    '=IFERROR(IF(MC_Unitario_Base>0,(Costos_Fijos_Base+Utilidad_Deseada)/MC_Unitario_Base,"N/D"),"N/D")',
  ],
  [
    "apalancamiento",
    "GAO",
    "Margen de contribución ÷ UAII",
    '=IFERROR(MC_Total_Base/UAII_CVU_Base,"N/D")',
  ],
  [
    "apalancamiento",
    "GAF",
    "UAII ÷ [UAII − I − DP ÷ (1 − T)]",
    '=IFERROR(UAII_CVU_Base/(UAII_CVU_Base-Intereses_Base-DP_Base/(1-Tasa_Base/100)),"N/D")',
  ],
  ["apalancamiento", "GAT", "GAO × GAF", '=IFERROR(GAO_Base*GAF_Base,"N/D")'],
  [
    "apalancamiento",
    "UPA",
    "(Utilidad neta − DP) ÷ Acciones",
    '=IFERROR((UN_CVU_Base-DP_Base)/Acciones_Base,"N/D")',
  ],
  [
    "flujo",
    "Cobros a clientes (vinculado)",
    "Ventas − Δ CxC",
    "=Ventas_Act-(CxC_Act-CxC_Ant)",
  ],
  [
    "flujo",
    "Compra neta de activo fijo (vinculado)",
    "−(Δ Activo fijo neto + Depreciación)",
    "=-(Activo_Fijo_Neto_Act-Activo_Fijo_Neto_Ant)-Depreciacion_Act",
  ],
  [
    "flujo",
    "Efectivo final",
    "Efectivo inicial + Variación neta",
    "=Efectivo_Inicial+Variacion_Neta_Efectivo",
  ],
  [
    "presupuestos",
    "Ventas del mes",
    "Unidades × Precio de venta",
    "=C24*Precio_Venta",
  ],
  [
    "presupuestos",
    "Compras (unidades)",
    "máx(0, Ventas + Inv. final deseado − Inv. inicial)",
    "=MAX(0,C30)",
  ],
  [
    "presupuestos",
    "Necesidad de financiamiento",
    "máx(0, Saldo mínimo − Saldo final)",
    "=MAX(0,Saldo_Minimo-C60)",
  ],
  [
    "proforma",
    "Ventas proforma",
    "Ventas × (1 + Crecimiento %)",
    "=Ventas_Act*(1+PF_Crecimiento/100)",
  ],
  [
    "proforma",
    "FER",
    "Activo total − (Pasivo + Patrimonio)",
    "=PF_Activo_Total-PF_Pasivo_Patrimonio",
  ],
  [
    "personal",
    "Saldo disponible",
    "Ingresos − Gastos",
    "=Total_Ingresos-Total_Gastos",
  ],
  [
    "personal",
    "Capacidad de ahorro",
    "Saldo disponible ÷ Ingresos",
    '=IFERROR(Saldo_Disponible/Total_Ingresos,"N/D")',
  ],
  [
    "inventario",
    "Existencia final",
    "Inicial + Entradas − Salidas",
    "=C6+D6-E6",
  ],
  [
    "inventario",
    "Valor del inventario",
    "Existencia × Costo unitario",
    "=H6*F6",
  ],
];

function buildFormulas(book) {
  const sh = new Sheet(book, "formulas", {
    title: "📚  FÓRMULAS UTILIZADAS",
    subtitle:
      "Referencia de fórmulas por módulo y de los nombres definidos que usa el libro",
    widths: [3, 36, 44, 66, 20],
  });
  let r = 5;
  sh.bar(r++, "🔹  FÓRMULAS POR MÓDULO");
  sh.header(r++, [
    "Concepto",
    "Fórmula financiera",
    "Fórmula en Excel (con nombres)",
    "Hoja",
  ]);
  for (const [key, concept, text, excel] of FORMULAS) {
    if (!book.has(key)) continue;
    sh.label(`B${r}`, concept);
    sh.put(`C${r}`, text, null, { align: "left" });
    // Se guarda como texto (no como fórmula) con un apóstrofo implícito.
    sh.put(`D${r}`, excel, null, { align: "left", color: P.blue2, size: 10 });
    sh.put(`E${r}`, SHEET_NAMES[key], null, { size: 10 });
    r++;
  }
  r += 1;
  sh.bar(r++, "🏷️  NOMBRES DEFINIDOS (Fórmulas → Administrador de nombres)");
  sh.note(
    r++,
    "Sufijo _Act = período analizado · _Ant = período base · _Base / _Esc = caso base y escenario de C-V-U. Escribe un nombre en el cuadro de nombres de Excel para ir a su celda.",
  );
  sh.header(r++, ["Nombre", "Descripción", "Ubicación", "Hoja"]);
  for (const n of book.names) {
    sh.put(`B${r}`, n.name, null, {
      align: "left",
      bold: true,
      color: P.blue2,
      size: 10,
    });
    sh.put(`C${r}`, n.desc, null, { align: "left", size: 10 });
    sh.put(`D${r}`, `'${n.sheet}'!${n.addr}`, null, {
      align: "left",
      size: 10,
    });
    sh.put(`E${r}`, n.sheet, null, { size: 10 });
    r++;
  }
  sh.freeze(2, 3);
}

/* ───────────────────────── API pública ───────────────────────── */

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default ?? mod;
}
async function loadJSZip() {
  const mod = await import("jszip");
  return mod.default ?? mod;
}

/** Construye el libro (sin gráficos). Devuelve { wb, book }. */
export async function buildWorkbookParts(data, section = "completo", ExcelJS) {
  ExcelJS ??= await loadExcelJS();
  const spec = EXPORT_SECTIONS[section] ?? EXPORT_SECTIONS.completo;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Finance Manager";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true; // Excel recalcula todo al abrir
  const book = new Book(wb, data, spec.sheets);
  const current = Math.min(
    Math.max(0, data.selected | 0),
    data.periods.length - 1,
  );
  const ctx = {
    cur: data.periods[current],
    prev: current > 0 ? data.periods[current - 1] : null,
  };
  let ef;
  // Las fórmulas pueden usar nombres definidos en hojas posteriores: Excel los
  // resuelve al calcular, así que el orden de construcción es el de las pestañas.
  const builders = {
    portada: () => buildPortada(book, ctx, spec),
    panel: () => buildPanel(book, ctx),
    estados: () => (ef = buildEstados(book, ctx)),
    analisis: () => buildAnalisis(book, ctx, ef),
    equilibrio: () => buildEquilibrio(book, ctx),
    apalancamiento: () => buildApalancamiento(book),
    flujo: () => buildFlujo(book, ctx, ef),
    presupuestos: () => buildPresupuestos(book, ctx),
    proforma: () => buildProforma(book, ctx),
    personal: () => buildPersonal(book),
    inventario: () => buildInventario(book),
    formulas: () => buildFormulas(book),
  };
  for (const key of Object.keys(SHEET_NAMES))
    if (book.has(key)) builders[key]();
  return { wb, book };
}

/** Devuelve solo el Workbook de ExcelJS (sin gráficos). */
export async function buildWorkbook(data, section = "completo", ExcelJS) {
  return (await buildWorkbookParts(data, section, ExcelJS)).wb;
}

/** Genera el .xlsx completo, con gráficos nativos, como Uint8Array. */
export async function buildXlsx(data, section = "completo", libs = {}) {
  const { wb, book } = await buildWorkbookParts(data, section, libs.ExcelJS);
  const buffer = await wb.xlsx.writeBuffer();
  return injectCharts(buffer, book.charts, libs.JSZip ?? (await loadJSZip()));
}

/** Genera el archivo y lo descarga en el navegador. */
export async function exportToExcel(data, section = "completo") {
  const spec = EXPORT_SECTIONS[section] ?? EXPORT_SECTIONS.completo;
  const bytes = await buildXlsx(data, section);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const slug = (data.company || "finance-manager")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug || "finance-manager"}-${spec.file}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return a.download;
}
