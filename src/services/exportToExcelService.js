// Exportación avanzada a Excel (.xlsx) con fórmulas nativas.
//
// Principio: la hoja "Estados Financieros" contiene los datos capturados (celdas
// azules editables). Todas las demás hojas calculan con fórmulas que apuntan a
// ella, de modo que al cambiar un saldo en Excel se recalculan análisis, razones,
// C-V-U, flujo de efectivo y caja. Las fórmulas replican lib/finance.js.
//
// exceljs se carga de forma diferida (import dinámico) para no aumentar el
// tamaño inicial de la aplicación.
import {
  accountGroups,
  defaultAccounts,
  linkedFlowSpec,
  num,
} from "../lib/finance.js";

export const SHEET_NAMES = {
  ef: "Estados Financieros",
  vh: "Análisis V-H",
  ratios: "Razones",
  cvu: "C-V-U",
  flow: "Flujo de Efectivo",
  cash: "Caja",
};

// Cada apartado incluye la hoja de Estados Financieros porque sus fórmulas dependen de ella.
export const EXPORT_SECTIONS = {
  completo: {
    label: "Libro completo",
    file: "libro-completo",
    sheets: ["ef", "vh", "ratios", "cvu", "flow", "cash"],
  },
  estados: {
    label: "Estados financieros",
    file: "estados-financieros",
    sheets: ["ef", "vh"],
  },
  razones: {
    label: "Razones y DuPont",
    file: "razones",
    sheets: ["ef", "ratios"],
  },
  equilibrio: { label: "C-V-U", file: "cvu", sheets: ["ef", "cvu"] },
  efectivo: {
    label: "Flujo de efectivo",
    file: "flujo-efectivo",
    sheets: ["ef", "flow"],
  },
  presupuesto: {
    label: "Presupuesto y caja",
    file: "presupuesto-caja",
    sheets: ["ef", "cash"],
  },
};

/* ───────────────────────── utilidades de celdas ───────────────────────── */

const COLORS = {
  brand: "FF2154B6",
  input: "FF0000FF",
  link: "FF00703C",
  text: "FF24334D",
  muted: "FF6B7A90",
  inputFill: "FFFFF8DC",
  sectionFill: "FFE8EFFB",
  totalFill: "FFF2F5FA",
  border: "FFD5DEEC",
};

export const colLetter = (n) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const quote = (name) => `'${name.replaceAll("'", "''")}'`;
const xref = (sheetKey, addr) => `${quote(SHEET_NAMES[sheetKey])}!${addr}`;
const abs = (col, row) => `$${col}$${row}`;

// Tipos de contenido de celda.
const inp = (value) => ({ kind: "input", value });
const fx = (formula) => ({ kind: "formula", formula });
const lnk = (formula) => ({ kind: "link", formula });
const div = (n, d) => `IFERROR((${n})/(${d}),"N/D")`;

const inputValue = (v) =>
  v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v);

function formats(currency) {
  const c = `"${currency.replaceAll('"', "")}" `;
  return {
    money: `${c}#,##0.00;[Red]-${c}#,##0.00`,
    pct: "0.00%",
    times: '0.00 "veces"',
    days: '0.00 "días"',
    units: "#,##0.00",
    rate: '0.00 "%"',
    plain: "0.00",
    int: "0",
  };
}

function setCell(cell, v, numFmt) {
  if (v == null) return;
  if (typeof v !== "object") {
    cell.value = v;
    return;
  }
  if (v.kind === "input") {
    cell.value = v.value;
    cell.font = { color: { argb: COLORS.input } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.inputFill },
    };
  } else {
    cell.value = { formula: v.formula };
    if (v.kind === "link") cell.font = { color: { argb: COLORS.link } };
  }
  if (numFmt) cell.numFmt = numFmt;
  cell.alignment = { horizontal: "right" };
}

function makeSheet(wb, key, title, subtitle, widths) {
  const ws = wb.addWorksheet(SHEET_NAMES[key], {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: COLORS.brand } },
  });
  ws.columns = widths.map((width) => ({ width }));
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = {
    bold: true,
    size: 15,
    color: { argb: COLORS.brand },
  };
  ws.getCell("A2").value = subtitle;
  ws.getCell("A2").font = { italic: true, color: { argb: COLORS.muted } };
  ws.getCell("A3").value =
    "Leyenda: azul con fondo crema = dato editable · negro = fórmula · verde = vínculo a otra hoja";
  ws.getCell("A3").font = { size: 9, color: { argb: COLORS.muted } };
  return ws;
}

/**
 * Inmoviliza la cabecera y la primera columna. topLeftCell/activeCell apuntan a la
 * primera celda desplazable para que Excel abra la hoja arriba, sin saltar a filas vacías.
 */
function freeze(ws, xSplit, ySplit) {
  const first = `${colLetter(xSplit + 1)}${ySplit + 1}`;
  ws.views = [
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

/**
 * Barra de datos sólida (extensión x14 de Excel 2010+): color propio para
 * valores positivos y otro para negativos, con el eje en el punto cero.
 */
function dataBar(positive, negative) {
  return {
    type: "dataBar",
    cfvo: [{ type: "min" }, { type: "max" }],
    color: { argb: positive },
    gradient: false,
    border: false,
    negativeBarColorSameAsPositive: false,
    negativeFillColor: { argb: negative },
    axisPosition: "auto",
    axisColor: { argb: "FF6B7A90" },
    minLength: 0,
    maxLength: 100,
  };
}

/**
 * Semáforo de 3 colores. Rojo < low ≤ amarillo < high ≤ verde.
 * reverse = true invierte la lectura (menor es mejor, p. ej. endeudamiento).
 */
function trafficLights(low, high, reverse = false) {
  return {
    type: "iconSet",
    iconSet: "3TrafficLights1",
    reverse,
    showValue: true,
    cfvo: [
      { type: "percent", value: 0 },
      { type: "num", value: low },
      { type: "num", value: high },
    ],
  };
}

/**
 * Motor de filas: primero asigna un número de fila a cada clave (para permitir
 * referencias hacia adelante, p. ej. el inventario inicial del mes 2 apunta al
 * inventario final del mes 1, que está más abajo) y después escribe.
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

function writeItems(ws, items, cols, fmt, { noteCol, labelCol = 1 } = {}) {
  const lastCol = Math.max(
    ...cols.map((c) => ws.getColumn(c).number),
    noteCol ? ws.getColumn(noteCol).number : 1,
  );
  for (const it of items) {
    const row = ws.getRow(it.row);
    if (it.kind === "blank") continue;
    row.getCell(labelCol).value = it.label;
    if (it.kind === "section") {
      for (let c = labelCol; c <= lastCol; c++) {
        row.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.sectionFill },
        };
      }
      row.getCell(labelCol).font = {
        bold: true,
        color: { argb: COLORS.brand },
      };
      continue;
    }
    if (it.kind === "header") {
      it.headers.forEach((h, i) => {
        row.getCell(i + labelCol + 1).value = h;
      });
      for (let c = labelCol; c <= lastCol; c++) {
        const cell = row.getCell(c);
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.brand },
        };
        cell.alignment = {
          horizontal: c === labelCol ? "left" : "center",
          wrapText: true,
        };
      }
      continue;
    }
    cols.forEach((c, i) =>
      setCell(ws.getCell(`${c}${it.row}`), it.cell(c, i), fmt[it.fmt]),
    );
    if (noteCol && it.note) {
      const n = ws.getCell(`${noteCol}${it.row}`);
      n.value = it.note;
      n.font = { italic: true, size: 9, color: { argb: COLORS.muted } };
    }
    if (it.kind === "total") {
      for (let c = labelCol; c <= lastCol; c++) {
        const cell = row.getCell(c);
        cell.font = { ...(cell.font || {}), bold: true };
        cell.border = {
          top: { style: "thin", color: { argb: COLORS.border } },
        };
        if (!cell.fill || cell.fill.fgColor?.argb !== COLORS.inputFill)
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLORS.totalFill },
          };
      }
    }
  }
}

/* ───────────────────────── hoja: Estados Financieros ───────────────────────── */

const RESULT_ROWS = [
  ["sales", "Ventas netas", "in"],
  ["cogs", "Costo de ventas", "in"],
  ["gross", "Utilidad bruta", "calc"],
  ["opex", "Gastos operativos desembolsables", "in"],
  ["depreciation", "Depreciación del período", "in"],
  ["ebit", "UAII / utilidad operativa", "calc"],
  ["otherIncome", "Otros ingresos netos (±)", "in"],
  ["interest", "Intereses", "in"],
  ["ebt", "Utilidad antes de impuestos", "calc"],
  ["taxRate", "Impuesto supuesto (%)", "in"],
  ["tax", "Impuestos", "calc"],
  ["net", "Utilidad neta", "calc"],
];

function buildStatements(wb, data, fmt) {
  const P = data.periods;
  const cols = P.map((_, i) => colLetter(i + 2));
  const ws = makeSheet(
    wb,
    "ef",
    "Estados financieros",
    `${data.company || "Empresa sin nombre"} · Moneda: ${data.currency} · Las demás hojas se calculan a partir de esta.`,
    [46, ...P.map(() => 18)],
  );
  const items = [
    {
      kind: "header",
      label: "Cuenta",
      headers: P.map((p, i) => p.label || `Período ${i + 1}`),
    },
    {
      key: "months",
      label: "Duración del período (meses)",
      fmt: "int",
      cell: (c, i) => inp(num(P[i].months) || 12),
    },
    { kind: "blank" },
    { kind: "section", label: "BALANCE GENERAL" },
  ];
  let R;
  for (const [group, label] of Object.entries(accountGroups)) {
    const accounts = data.accounts.filter((a) => a.group === group);
    items.push({ kind: "section", label });
    for (const a of accounts)
      items.push({
        key: `acc:${a.id}`,
        label: a.label,
        fmt: "money",
        cell: (c, i) => inp(inputValue(P[i].balance[a.id])),
      });
    items.push({
      key: `g:${group}`,
      kind: "total",
      label: `Total ${label.toLowerCase()}`,
      fmt: "money",
      cell: (c) =>
        fx(
          accounts.length
            ? accounts
                .map(
                  (a, j) =>
                    `${a.id === "accDep" ? "-" : j ? "+" : ""}${c}${R[`acc:${a.id}`]}`,
                )
                .join("")
            : "0",
        ),
    });
  }
  items.push(
    { kind: "blank" },
    {
      key: "assets",
      kind: "total",
      label: "TOTAL ACTIVOS",
      fmt: "money",
      cell: (c) =>
        fx(
          `${c}${R["g:current"]}+${c}${R["g:fixed"]}+${c}${R["g:otherAsset"]}`,
        ),
    },
    {
      key: "liabilities",
      kind: "total",
      label: "TOTAL PASIVOS",
      fmt: "money",
      cell: (c) => fx(`${c}${R["g:currentDebt"]}+${c}${R["g:longDebt"]}`),
    },
    {
      key: "equity",
      kind: "total",
      label: "TOTAL PATRIMONIO",
      fmt: "money",
      cell: (c) => fx(`${c}${R["g:equity"]}`),
    },
    {
      key: "liabEquity",
      kind: "total",
      label: "TOTAL PASIVOS + PATRIMONIO",
      fmt: "money",
      cell: (c) => fx(`${c}${R.liabilities}+${c}${R.equity}`),
    },
    {
      key: "difference",
      label: "Diferencia: activos − pasivos − patrimonio (debe ser 0)",
      fmt: "money",
      cell: (c) => fx(`${c}${R.assets}-${c}${R.liabilities}-${c}${R.equity}`),
    },
    { kind: "blank" },
    { kind: "section", label: "ESTADO DE RESULTADOS" },
  );
  const calc = {
    gross: (c) => `${c}${R.sales}-${c}${R.cogs}`,
    ebit: (c) => `${c}${R.gross}-${c}${R.opex}-${c}${R.depreciation}`,
    ebt: (c) => `${c}${R.ebit}+${c}${R.otherIncome}-${c}${R.interest}`,
    // Convención académica: sin crédito fiscal automático en pérdidas.
    tax: (c) => `MAX(0,${c}${R.ebt})*${c}${R.taxRate}/100`,
    net: (c) => `${c}${R.ebt}-${c}${R.tax}`,
  };
  for (const [key, label, type] of RESULT_ROWS)
    items.push({
      key,
      label,
      kind: type === "calc" ? "total" : undefined,
      fmt: key === "taxRate" ? "rate" : "money",
      cell: (c, i) =>
        type === "in" ? inp(inputValue(P[i].income[key])) : fx(calc[key](c)),
    });
  items.push(
    { kind: "blank" },
    { kind: "section", label: "DATOS COMPLEMENTARIOS PARA RAZONES" },
    {
      key: "creditPct",
      label: "Ventas a crédito (%)",
      fmt: "rate",
      cell: (c, i) => inp(inputValue(P[i].income.creditPct)),
    },
    {
      key: "creditPurchases",
      label: "Compras a crédito para razones",
      fmt: "money",
      cell: (c, i) => inp(inputValue(P[i].income.creditPurchases)),
    },
  );
  ({ R } = layout(items, 5));
  writeItems(ws, items, cols, fmt);
  freeze(ws, 1, 5);
  // Referencias absolutas hacia esta hoja para las demás.
  return {
    cell: (key, pi) => (R[key] ? xref("ef", abs(cols[pi], R[key])) : "0"),
    acc: (id, pi) =>
      R[`acc:${id}`] ? xref("ef", abs(cols[pi], R[`acc:${id}`])) : "0",
  };
}

/* ───────────────────────── hoja: Análisis vertical y horizontal ───────────────────────── */

function buildAnalysis(wb, data, fmt, ef, { base, current }) {
  const P = data.periods;
  const bl = P[base].label,
    cl = P[current].label;
  const ws = makeSheet(
    wb,
    "vh",
    "Análisis vertical y horizontal",
    `Base: ${bl} · Actual: ${cl}. Vertical = cuenta / total de activos (o ventas). Horizontal = actual − base y (actual − base) / base.`,
    [42, 17, 17, 14, 14, 17, 14],
  );
  const sign = (id) => (id === "accDep" ? "-" : "");
  const vertical = (denKey) => (c, i, row) =>
    fx(div(`${c}${row}`, ef.cell(denKey, i === 0 ? base : current)));
  const make = (label, valueOf, denKey, kind) => ({
    label,
    kind,
    cell: (c, i, row) => {
      if (i < 2) return lnk(valueOf(i === 0 ? base : current));
      if (i < 4) return vertical(denKey)(i === 2 ? "B" : "C", i - 2, row);
      if (i === 4) return fx(`C${row}-B${row}`);
      return fx(div(`C${row}-B${row}`, `B${row}`));
    },
  });
  const items = [
    {
      kind: "header",
      label: "Cuenta",
      headers: [
        bl,
        cl,
        `Vertical ${bl}`,
        `Vertical ${cl}`,
        `Variación ${data.currency}`,
        "Variación %",
      ],
    },
    {
      kind: "section",
      label: "BALANCE GENERAL (base vertical: total de activos)",
    },
    ...data.accounts.map((a) =>
      make(a.label, (pi) => `${sign(a.id)}${ef.acc(a.id, pi)}`, "assets"),
    ),
    make("Total activos", (pi) => ef.cell("assets", pi), "assets", "total"),
    make(
      "Total pasivos",
      (pi) => ef.cell("liabilities", pi),
      "assets",
      "total",
    ),
    make("Total patrimonio", (pi) => ef.cell("equity", pi), "assets", "total"),
    { kind: "blank" },
    {
      kind: "section",
      label: "ESTADO DE RESULTADOS (base vertical: ventas netas)",
    },
    ...RESULT_ROWS.filter(([k]) => k !== "taxRate").map(([k, label, t]) =>
      make(
        label,
        (pi) => ef.cell(k, pi),
        "sales",
        t === "calc" ? "total" : undefined,
      ),
    ),
  ];
  layout(items, 5);
  const cols = ["B", "C", "D", "E", "F", "G"];
  const fmts = ["money", "money", "pct", "pct", "money", "pct"];
  for (const it of items) {
    if (!it.cell) continue;
    const c0 = it.cell;
    it.cell = (c, i) => c0(c, i, it.row);
  }
  writeItems(ws, items, cols, fmt);
  // Barras de datos en «Variación %»: verde si aumenta, roja si disminuye.
  const dataRows = items.filter((it) => it.cell).map((it) => it.row);
  ws.addConditionalFormatting({
    ref: `G${dataRows[0]}:G${dataRows.at(-1)}`,
    rules: [dataBar("FF17A34A", "FFDC2626")],
  });
  // Formato por columna (el motor aplica uno por fila).
  for (const it of items)
    if (it.cell)
      cols.forEach(
        (c, i) => (ws.getCell(`${c}${it.row}`).numFmt = fmt[fmts[i]]),
      );
  freeze(ws, 1, 5);
}

/* ───────────────────────── hoja: Razones financieras ───────────────────────── */

function buildRatios(wb, data, fmt, ef, { current, previous }) {
  const p = current,
    q = previous;
  const P = data.periods;
  const ws = makeSheet(
    wb,
    "ratios",
    "Razones financieras y sistema DuPont",
    q == null
      ? `${P[p].label}. Solo hay un balance: los promedios usan saldos de cierre.`
      : `${P[p].label}. Promedios entre ${P[q].label} y ${P[p].label}; liquidez y endeudamiento usan el cierre.`,
    [36, 50, 18, 34],
  );
  const E = (k) => ef.cell(k, p);
  const avg = (getter) =>
    q == null ? getter(p) : `(${getter(p)}+${getter(q)})/2`;
  let R;
  const C = (k) => `C${R[k]}`;
  const row = (key, label, note, formula, f, kind) => ({
    key,
    label,
    kind,
    fmt: f,
    cell: (c, i) =>
      i === 0 ? note : typeof formula === "function" ? fx(formula()) : formula,
  });
  const items = [
    {
      kind: "header",
      label: "Concepto",
      headers: ["Fórmula", "Resultado", "Semáforo (referencia académica)"],
    },
    { kind: "section", label: "DATOS DE CÁLCULO" },
    row(
      "days",
      "Días del período",
      "365 × meses / 12",
      () => `365*${E("months")}/12`,
      "days",
    ),
    row(
      "aAvg",
      "Activo total promedio",
      "(Activo actual + anterior) / 2",
      () => avg((i) => ef.cell("assets", i)),
      "money",
    ),
    row(
      "eAvg",
      "Patrimonio promedio",
      "(Patrimonio actual + anterior) / 2",
      () => avg((i) => ef.cell("equity", i)),
      "money",
    ),
    row(
      "fAvg",
      "Activo fijo neto promedio",
      "(Activo fijo actual + anterior) / 2",
      () => avg((i) => ef.cell("g:fixed", i)),
      "money",
    ),
    row(
      "invAvg",
      "Inventario promedio",
      "(Inventario actual + anterior) / 2",
      () => avg((i) => ef.acc("inventory", i)),
      "money",
    ),
    row(
      "arAvg",
      "CxC promedio",
      "(CxC actual + anterior) / 2",
      () => avg((i) => ef.acc("receivables", i)),
      "money",
    ),
    row(
      "apAvg",
      "CxP promedio",
      "(CxP actual + anterior) / 2",
      () => avg((i) => ef.acc("payables", i)),
      "money",
    ),
    row(
      "creditSales",
      "Ventas a crédito",
      "Ventas × % a crédito",
      () => `${E("sales")}*${E("creditPct")}/100`,
      "money",
    ),
    { kind: "section", label: "LIQUIDEZ" },
    row(
      "ctn",
      "Capital de trabajo neto",
      "Activo corriente − Pasivo corriente",
      () => `${E("g:current")}-${E("g:currentDebt")}`,
      "money",
    ),
    row(
      "current",
      "Razón corriente",
      "Activo corriente / Pasivo corriente",
      () => div(E("g:current"), E("g:currentDebt")),
      "times",
    ),
    row(
      "acid",
      "Prueba ácida",
      "(Activo corriente − Inventarios) / Pasivo corriente",
      () =>
        div(`${E("g:current")}-${ef.acc("inventory", p)}`, E("g:currentDebt")),
      "times",
    ),
    { kind: "section", label: "ACTIVIDAD" },
    row(
      "invRot",
      "Rotación de inventario",
      "Costo de ventas / Inventario promedio",
      () => div(E("cogs"), C("invAvg")),
      "times",
    ),
    row(
      "invDays",
      "Edad promedio de inventario",
      "Días / Rotación de inventario",
      () => div(C("days"), C("invRot")),
      "days",
    ),
    row(
      "arRot",
      "Rotación de CxC",
      "Ventas a crédito / CxC promedio",
      () => div(C("creditSales"), C("arAvg")),
      "times",
    ),
    row(
      "arDays",
      "Período promedio de cobro",
      "Días / Rotación de CxC",
      () => div(C("days"), C("arRot")),
      "days",
    ),
    row(
      "apRot",
      "Rotación de CxP",
      "Compras a crédito / CxP promedio",
      () => div(E("creditPurchases"), C("apAvg")),
      "times",
    ),
    row(
      "apDays",
      "Período promedio de pago",
      "Días / Rotación de CxP",
      () => div(C("days"), C("apRot")),
      "days",
    ),
    row(
      "fixedRot",
      "Rotación de activos fijos",
      "Ventas / Activo fijo neto promedio",
      () => div(E("sales"), C("fAvg")),
      "times",
    ),
    row(
      "turnover",
      "Rotación de activos totales",
      "Ventas / Activo total promedio",
      () => div(E("sales"), C("aAvg")),
      "times",
    ),
    { kind: "section", label: "ENDEUDAMIENTO" },
    row(
      "debt",
      "Razón de endeudamiento",
      "Pasivo total / Activo total",
      () => div(E("liabilities"), E("assets")),
      "pct",
    ),
    row(
      "debtEquity",
      "Deuda / patrimonio",
      "Pasivo total / Patrimonio",
      () => div(E("liabilities"), E("equity")),
      "times",
    ),
    row(
      "coverage",
      "Cobertura de intereses",
      "UAII / Intereses",
      () => div(E("ebit"), E("interest")),
      "times",
    ),
    { kind: "section", label: "RENTABILIDAD" },
    row(
      "grossMargin",
      "Margen bruto",
      "Utilidad bruta / Ventas",
      () => div(E("gross"), E("sales")),
      "pct",
    ),
    row(
      "opMargin",
      "Margen operativo",
      "UAII / Ventas",
      () => div(E("ebit"), E("sales")),
      "pct",
    ),
    row(
      "margin",
      "Margen neto",
      "Utilidad neta / Ventas",
      () => div(E("net"), E("sales")),
      "pct",
    ),
    row(
      "roa",
      "ROA",
      "Utilidad neta / Activo promedio",
      () => div(E("net"), C("aAvg")),
      "pct",
    ),
    row(
      "roe",
      "ROE",
      "Utilidad neta / Patrimonio promedio",
      () => div(E("net"), C("eAvg")),
      "pct",
    ),
    { kind: "section", label: "SISTEMA DUPONT" },
    row(
      "dMargin",
      "Margen neto",
      "Utilidad neta / Ventas",
      () => C("margin"),
      "pct",
    ),
    row(
      "dTurn",
      "× Rotación de activos",
      "Ventas / Activo promedio",
      () => C("turnover"),
      "times",
    ),
    row(
      "multiplier",
      "× Multiplicador del capital",
      "Activo promedio / Patrimonio promedio",
      () => div(C("aAvg"), C("eAvg")),
      "times",
    ),
    row(
      "dupont",
      "ROE DuPont",
      "Margen × Rotación × Multiplicador",
      () => div(`${C("dMargin")}*${C("dTurn")}*${C("multiplier")}`, "1"),
      "pct",
      "total",
    ),
  ];
  // Umbrales del semáforo: [rojo por debajo de, verde desde, invertido, leyenda].
  const pct = (v) => `${v * 100}%`;
  const lights = {
    ctn: [0, 0, false, "Rojo si es negativo"],
    current: [1, 1.5, false, "Rojo < 1 · Amarillo 1–1.5 · Verde ≥ 1.5"],
    acid: [0.8, 1, false, "Rojo < 0.8 · Amarillo 0.8–1 · Verde ≥ 1"],
    debt: [0.5, 0.7, true, "Verde < 50% · Amarillo 50–70% · Rojo ≥ 70%"],
    debtEquity: [1, 2, true, "Verde < 1 · Amarillo 1–2 · Rojo ≥ 2"],
    coverage: [1.5, 3, false, "Rojo < 1.5 · Amarillo 1.5–3 · Verde ≥ 3"],
    grossMargin: [
      0,
      0.2,
      false,
      `Rojo < 0 · Amarillo 0–${pct(0.2)} · Verde ≥ ${pct(0.2)}`,
    ],
    opMargin: [
      0,
      0.1,
      false,
      `Rojo < 0 · Amarillo 0–${pct(0.1)} · Verde ≥ ${pct(0.1)}`,
    ],
    margin: [
      0,
      0.05,
      false,
      `Rojo < 0 · Amarillo 0–${pct(0.05)} · Verde ≥ ${pct(0.05)}`,
    ],
    roa: [
      0,
      0.05,
      false,
      `Rojo < 0 · Amarillo 0–${pct(0.05)} · Verde ≥ ${pct(0.05)}`,
    ],
    roe: [
      0,
      0.1,
      false,
      `Rojo < 0 · Amarillo 0–${pct(0.1)} · Verde ≥ ${pct(0.1)}`,
    ],
    dupont: [
      0,
      0.1,
      false,
      `Rojo < 0 · Amarillo 0–${pct(0.1)} · Verde ≥ ${pct(0.1)}`,
    ],
  };
  for (const it of items) if (lights[it.key]) it.note = lights[it.key][3];
  ({ R } = layout(items, 5));
  writeItems(ws, items, ["B", "C"], fmt, { noteCol: "D" });
  for (const [key, [low, high, reverse]] of Object.entries(lights))
    ws.addConditionalFormatting({
      ref: `C${R[key]}`,
      rules: [trafficLights(low, high, reverse)],
    });
  for (const it of items)
    if (it.cell)
      ws.getCell(`B${it.row}`).font = {
        italic: true,
        color: { argb: COLORS.muted },
      };
  freeze(ws, 1, 5);
}

/* ───────────────────────── hoja: C-V-U y apalancamiento ───────────────────────── */

function buildCvu(wb, data, fmt, ef, { current }) {
  const c = data.cvu,
    p = current,
    E = (k) => ef.cell(k, p);
  const ws = makeSheet(
    wb,
    "cvu",
    "Costo-Volumen-Utilidad y apalancamiento",
    c.linked
      ? `Vinculado a ${data.periods[p].label}: costo de ventas = variable; gastos operativos + depreciación = fijos.`
      : "Supuestos manuales.",
    [40, 18, 18, 46],
  );
  let R;
  const B = (k) => `$B$${R[k]}`;
  const base = (k, linkedFormula) =>
    c.linked && linkedFormula ? lnk(linkedFormula()) : inp(inputValue(c[k]));
  const items = [
    {
      kind: "header",
      label: "Supuesto",
      headers: ["Base", "Escenario", "Nota"],
    },
    { kind: "section", label: "DATOS DE OPERACIÓN" },
    {
      key: "units",
      label: "Unidades vendidas",
      fmt: "units",
      cell: (col, i) =>
        i
          ? fx(`IF(${B("sUnits")}="",${B("units")},${B("sUnits")})`)
          : inp(inputValue(c.units)),
    },
    {
      key: "price",
      label: "Precio unitario",
      fmt: "money",
      note: c.linked ? "Ventas del estado / unidades" : "",
      cell: (col, i) =>
        i
          ? fx(`IFERROR(${B("price")}*(1+${B("sPrice")}/100),"N/D")`)
          : base("price", () => div(E("sales"), B("units"))),
    },
    {
      key: "variable",
      label: "Costo variable unitario",
      fmt: "money",
      note: c.linked ? "Costo de ventas / unidades" : "",
      cell: (col, i) =>
        i
          ? fx(`IFERROR(${B("variable")}*(1+${B("sCost")}/100),"N/D")`)
          : base("variable", () => div(E("cogs"), B("units"))),
    },
    {
      key: "fixed",
      label: "Costos fijos operativos",
      fmt: "money",
      note: c.linked ? "Gastos operativos + depreciación" : "",
      cell: (col, i) =>
        i
          ? fx(`${B("fixed")}*(1+${B("sFixed")}/100)`)
          : base("fixed", () => `${E("opex")}+${E("depreciation")}`),
    },
    {
      key: "interest",
      label: "Intereses",
      fmt: "money",
      cell: (col, i) =>
        i ? fx(B("interest")) : base("interest", () => E("interest")),
    },
    {
      key: "taxRate",
      label: "Impuesto supuesto (%)",
      fmt: "rate",
      cell: (col, i) =>
        i ? fx(B("taxRate")) : base("taxRate", () => E("taxRate")),
    },
    {
      key: "dividends",
      label: "Dividendos preferentes (DP)",
      fmt: "money",
      cell: (col, i) => (i ? fx(B("dividends")) : inp(inputValue(c.dividends))),
    },
    {
      key: "shares",
      label: "Acciones comunes",
      fmt: "units",
      cell: (col, i) => (i ? fx(B("shares")) : inp(inputValue(c.shares))),
    },
    { kind: "section", label: "PARÁMETROS DEL ESCENARIO (columna B)" },
    {
      key: "sUnits",
      label: "Unidades del escenario",
      fmt: "units",
      note: "Vacío = unidades base",
      cell: (col, i) => (i ? null : inp(inputValue(c.scenarioUnits))),
    },
    {
      key: "sPrice",
      label: "Cambio en precio (%)",
      fmt: "rate",
      cell: (col, i) => (i ? null : inp(inputValue(c.priceChange))),
    },
    {
      key: "sCost",
      label: "Cambio en CV unitario (%)",
      fmt: "rate",
      cell: (col, i) => (i ? null : inp(inputValue(c.costChange))),
    },
    {
      key: "sFixed",
      label: "Cambio en costos fijos (%)",
      fmt: "rate",
      cell: (col, i) => (i ? null : inp(inputValue(c.fixedChange))),
    },
    { kind: "section", label: "RESULTADOS" },
  ];
  const res = (key, label, f, formula, note, kind) =>
    items.push({
      key,
      label,
      fmt: f,
      note,
      kind,
      cell: (col) => fx(`IFERROR(${formula((k) => `${col}${R[k]}`)},"N/D")`),
    });
  res(
    "mcu",
    "Margen de contribución unitario",
    "money",
    (X) => `${X("price")}-${X("variable")}`,
    "Precio − CV unitario",
  );
  res(
    "sales",
    "Ventas",
    "money",
    (X) => `${X("units")}*${X("price")}`,
    "Unidades × Precio",
  );
  res(
    "varTotal",
    "Costos variables totales",
    "money",
    (X) => `${X("units")}*${X("variable")}`,
    "Unidades × CV unitario",
  );
  res(
    "mc",
    "Margen de contribución total",
    "money",
    (X) => `${X("sales")}-${X("varTotal")}`,
    "Ventas − Costos variables",
    "total",
  );
  res(
    "ebit",
    "UAII",
    "money",
    (X) => `${X("mc")}-${X("fixed")}`,
    "MC − Costos fijos",
    "total",
  );
  res(
    "ebt",
    "Utilidad antes de impuestos",
    "money",
    (X) => `${X("ebit")}-${X("interest")}`,
    "UAII − Intereses",
  );
  res(
    "tax",
    "Impuestos",
    "money",
    (X) => `MAX(0,${X("ebt")})*${X("taxRate")}/100`,
    "Sin crédito fiscal en pérdidas",
  );
  res(
    "net",
    "Utilidad neta",
    "money",
    (X) => `${X("ebt")}-${X("tax")}`,
    "",
    "total",
  );
  res(
    "eps",
    "Utilidad por acción (UPA)",
    "money",
    (X) => div(`${X("net")}-${X("dividends")}`, X("shares")),
    "(UN − DP) / Acciones",
  );
  res(
    "q",
    "Punto de equilibrio (unidades)",
    "units",
    (X) => `IF(${X("mcu")}>0,${X("fixed")}/${X("mcu")},"N/D")`,
    "Costos fijos / MC unitario",
    "total",
  );
  res(
    "qMoney",
    "Ventas de equilibrio",
    "money",
    (X) => `IFERROR(${X("q")}*${X("price")},"N/D")`,
    "Q × Precio = CF / (1 − CV/P)",
  );
  res(
    "safety",
    "Margen de seguridad",
    "pct",
    (X) => div(`${X("units")}-${X("q")}`, X("units")),
    "(Unidades − Q) / Unidades",
  );
  items.push({
    kind: "section",
    label: "GRADOS DE APALANCAMIENTO · MÉTODO DIRECTO",
  });
  res("gao", "GAO", "times", (X) => div(X("mc"), X("ebit")), "MC / UAII");
  res(
    "gaf",
    "GAF",
    "times",
    (X) =>
      div(
        X("ebit"),
        `${X("ebit")}-${X("interest")}-${div(X("dividends"), `1-${X("taxRate")}/100`)}`,
      ),
    "UAII / [UAII − I − DP/(1−T)]",
  );
  res(
    "gat",
    "GAT",
    "times",
    (X) => div(`${X("gao")}*${X("gaf")}`, "1"),
    "GAO × GAF",
    "total",
  );
  items.push({
    kind: "section",
    label: "MÉTODO DE VARIACIONES (escenario vs. base, columna C)",
  });
  const vary = (key, label, f, formula, note) =>
    items.push({
      key,
      label,
      fmt: f,
      note,
      cell: (col, i) => (i ? fx(formula()) : null),
    });
  const d = (k) => div(`$C$${R[k]}-$B$${R[k]}`, `$B$${R[k]}`);
  vary(
    "dS",
    "Cambio en ventas",
    "pct",
    () => d("sales"),
    "(Escenario − Base) / Base",
  );
  vary(
    "dE",
    "Cambio en UAII",
    "pct",
    () => d("ebit"),
    "(Escenario − Base) / Base",
  );
  vary(
    "dP",
    "Cambio en UPA",
    "pct",
    () => d("eps"),
    "(Escenario − Base) / Base",
  );
  vary(
    "vGao",
    "GAO por variaciones",
    "times",
    () => div(`C${R.dE}`, `C${R.dS}`),
    "%Δ UAII / %Δ Ventas",
  );
  vary(
    "vGaf",
    "GAF por variaciones",
    "times",
    () => div(`C${R.dP}`, `C${R.dE}`),
    "%Δ UPA / %Δ UAII",
  );
  vary(
    "vGat",
    "GAT por variaciones",
    "times",
    () => div(`C${R.dP}`, `C${R.dS}`),
    "%Δ UPA / %Δ Ventas",
  );
  ({ R } = layout(items, 5));
  writeItems(ws, items, ["B", "C"], fmt, { noteCol: "D" });
  freeze(ws, 1, 5);
}

/* ───────────────────────── hoja: Flujo de efectivo ───────────────────────── */

const GROUP_LABEL = {
  operating: "Operación",
  investing: "Inversión",
  financing: "Financiamiento",
};

// EFE vinculado: cada línea es una fórmula construida con la misma especificación
// que usa la app (linkedFlowSpec), apuntando a la hoja de Estados Financieros.
function buildCashFlowLinked(wb, data, fmt, ef, { current, previous }) {
  const P = data.periods,
    p = P[current],
    q = P[previous];
  const ws = makeSheet(
    wb,
    "flow",
    "Estado de flujo de efectivo (vinculado)",
    `${q.label} → ${p.label}. Calculado con fórmulas desde «Estados Financieros»: cambia un saldo allí y este estado se recalcula.`,
    [64, 20, 46],
  );
  const defaults = new Set(defaultAccounts.map((a) => a.id));
  const delta = (cur, prev) => `(${cur}-${prev})`;
  const term = ([type, ref, sign]) => {
    const body =
      type === "inc"
        ? ef.cell(ref, current)
        : type === "acc"
          ? delta(ef.acc(ref, current), ef.acc(ref, previous))
          : type === "grp"
            ? delta(ef.cell(`g:${ref}`, current), ef.cell(`g:${ref}`, previous))
            : `(${
                data.accounts
                  .filter((a) => a.group === ref && !defaults.has(a.id))
                  .map((a) =>
                    delta(ef.acc(a.id, current), ef.acc(a.id, previous)),
                  )
                  .join("+") || "0"
              })`;
    return `${sign < 0 ? "-" : "+"}${body}`;
  };
  const lineFormula = (terms) => terms.map(term).join("").replace(/^\+/, "");
  const spec = linkedFlowSpec(data.accounts);
  let R;
  const B = (k) => `B${R[k]}`;
  const items = [
    {
      kind: "header",
      label: "Concepto",
      headers: [data.currency, "Fórmula de la línea"],
    },
  ];
  const groupKeys = { operating: "op", investing: "inv", financing: "fin" };
  for (const [g, label] of Object.entries(GROUP_LABEL)) {
    items.push({
      kind: "section",
      label: `ACTIVIDADES DE ${label.toUpperCase()}`,
    });
    for (const l of spec[g])
      items.push({
        key: `${g}:${l.key}`,
        label: l.label,
        fmt: "money",
        cell: () => fx(lineFormula(l.terms)),
      });
    items.push({
      key: groupKeys[g],
      kind: "total",
      label: `Flujo de ${label.toLowerCase()}`,
      fmt: "money",
      cell: () =>
        fx(
          `SUM(B${R[`${g}:${spec[g][0].key}`]}:B${R[`${g}:${spec[g].at(-1).key}`]})`,
        ),
    });
  }
  items.push(
    { kind: "blank" },
    { kind: "section", label: "RESUMEN" },
    {
      key: "initial",
      label: `Saldo inicial (efectivo de ${q.label})`,
      fmt: "money",
      cell: () => lnk(ef.acc("cash", previous)),
    },
    {
      key: "net",
      label: "Variación neta de efectivo",
      fmt: "money",
      kind: "total",
      cell: () => fx(`${B("op")}+${B("inv")}+${B("fin")}`),
    },
    {
      key: "final",
      label: "Saldo final de efectivo",
      fmt: "money",
      kind: "total",
      cell: () => fx(`${B("initial")}+${B("net")}`),
    },
    { kind: "blank" },
    { kind: "section", label: "MÉTODO INDIRECTO" },
    ...spec.indirect.map((l) => ({
      key: `ind:${l.key}`,
      label: l.label,
      fmt: "money",
      cell: () => fx(lineFormula(l.terms)),
    })),
    {
      key: "indirect",
      kind: "total",
      label: "Flujo de operación (indirecto)",
      fmt: "money",
      cell: () =>
        fx(
          `SUM(B${R[`ind:${spec.indirect[0].key}`]}:B${R[`ind:${spec.indirect.at(-1).key}`]})`,
        ),
    },
    { kind: "blank" },
    { kind: "section", label: "CONCILIACIÓN" },
    {
      key: "bal",
      label: `Efectivo en balance de ${p.label}`,
      fmt: "money",
      cell: () => lnk(ef.acc("cash", current)),
    },
    {
      key: "dBal",
      label: "Diferencia saldo final − balance (0 si ambos balances cuadran)",
      fmt: "money",
      cell: () => fx(`${B("final")}-${B("bal")}`),
    },
    {
      key: "dMeth",
      label: "Diferencia operación directa − indirecta",
      fmt: "money",
      cell: () => fx(`${B("op")}-${B("indirect")}`),
    },
  );
  // Nota legible con la fórmula de cada línea.
  const describe = (terms) =>
    terms
      .map(([type, ref, sign], i) => {
        const name =
          type === "inc"
            ? RESULT_ROWS.find(([k]) => k === ref)?.[1] || ref
            : type === "acc"
              ? `Δ ${data.accounts.find((a) => a.id === ref)?.label || ref}`
              : type === "grp"
                ? `Δ ${accountGroups[ref]}`
                : `Δ cuentas adicionales (${accountGroups[ref].toLowerCase()})`;
        return `${sign < 0 ? "− " : i ? "+ " : ""}${name}`;
      })
      .join(" ");
  for (const it of items) {
    const [g, k] = it.key?.split(":") ?? [];
    const line = (g === "ind" ? spec.indirect : spec[g])?.find(
      (l) => l.key === k,
    );
    if (line) it.note = describe(line.terms);
  }
  ({ R } = layout(items, 5));
  writeItems(ws, items, ["B"], fmt, { noteCol: "C" });
  freeze(ws, 1, 5);
}

function buildCashFlow(wb, data, fmt, ef, ctx) {
  const { current, previous } = ctx;
  if (data.flow.linked && previous != null)
    return buildCashFlowLinked(wb, data, fmt, ef, ctx);
  const P = data.periods,
    p = P[current],
    prev = previous == null ? null : P[previous];
  const settings = data.flow.settings?.[p.id] || {};
  const ws = makeSheet(
    wb,
    "flow",
    "Estado de flujo de efectivo",
    `${p.label}. Agrega movimientos en las filas libres: los totales se recalculan con SUMIF.`,
    [40, 18, 14, 18, 18],
  );
  // Tabla de movimientos (método directo).
  let r = 5;
  const head = ws.getRow(r);
  [
    "Concepto",
    "Actividad",
    "Movimiento",
    `Importe ${data.currency}`,
    "Importe con signo",
  ].forEach((h, i) => {
    const cell = head.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.brand },
    };
  });
  const entries = data.flow.entries.filter((e) => e.periodId === p.id);
  const first = r + 1;
  const spare = 10; // filas libres para que el usuario agregue movimientos en Excel
  for (let k = 0; k < entries.length + spare; k++) {
    r += 1;
    const e = entries[k];
    const style = (cell) => {
      cell.font = { color: { argb: COLORS.input } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.inputFill },
      };
    };
    ["A", "B", "C", "D"].forEach((c) => style(ws.getCell(`${c}${r}`)));
    if (e) {
      ws.getCell(`A${r}`).value = e.label || "Movimiento";
      ws.getCell(`B${r}`).value = GROUP_LABEL[e.group] || "Operación";
      ws.getCell(`C${r}`).value = e.direction === "out" ? "Salida" : "Entrada";
      ws.getCell(`D${r}`).value = inputValue(e.amount);
    }
    ws.getCell(`B${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Operación,Inversión,Financiamiento"'],
    };
    ws.getCell(`C${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Entrada,Salida"'],
    };
    ws.getCell(`D${r}`).numFmt = fmt.money;
    ws.getCell(`E${r}`).value = { formula: `IF(C${r}="Salida",-D${r},D${r})` };
    ws.getCell(`E${r}`).numFmt = fmt.money;
  }
  const last = r;
  const sumif = (label) =>
    `SUMIF($B$${first}:$B$${last},"${label}",$E$${first}:$E$${last})`;
  const E = (k, pi) => ef.cell(k, pi);
  const A = (id, pi) => ef.acc(id, pi);
  const delta = (id) => `(${A(id, current)}-${A(id, previous)})`;
  let R;
  const B = (k) => `B${R[k]}`;
  const items = [
    { kind: "section", label: "RESUMEN · MÉTODO DIRECTO" },
    {
      key: "initial",
      label: "Saldo inicial de efectivo",
      fmt: "money",
      cell: () =>
        prev ? lnk(A("cash", previous)) : inp(inputValue(settings.initialCash)),
    },
    {
      key: "op",
      label: "Flujo de operación",
      fmt: "money",
      cell: () => fx(sumif("Operación")),
    },
    {
      key: "inv",
      label: "Flujo de inversión",
      fmt: "money",
      cell: () => fx(sumif("Inversión")),
    },
    {
      key: "fin",
      label: "Flujo de financiamiento",
      fmt: "money",
      cell: () => fx(sumif("Financiamiento")),
    },
    {
      key: "net",
      label: "Variación neta de efectivo",
      fmt: "money",
      kind: "total",
      cell: () => fx(`${B("op")}+${B("inv")}+${B("fin")}`),
    },
    {
      key: "final",
      label: "Saldo final de efectivo (directo)",
      fmt: "money",
      kind: "total",
      cell: () => fx(`${B("initial")}+${B("net")}`),
    },
  ];
  if (prev) {
    items.push(
      { kind: "blank" },
      {
        kind: "section",
        label: `MÉTODO INDIRECTO (variaciones ${prev.label} → ${p.label})`,
      },
      {
        key: "iNet",
        label: "Utilidad neta",
        fmt: "money",
        cell: () => lnk(E("net", current)),
      },
      {
        key: "iDep",
        label: "+ Depreciación",
        fmt: "money",
        cell: () => lnk(E("depreciation", current)),
      },
      {
        key: "iAr",
        label: "− Variación de CxC",
        fmt: "money",
        cell: () => fx(`-${delta("receivables")}`),
      },
      {
        key: "iInv",
        label: "− Variación de inventario",
        fmt: "money",
        cell: () => fx(`-${delta("inventory")}`),
      },
      {
        key: "iOca",
        label: "− Variación de otros activos corrientes",
        fmt: "money",
        cell: () => fx(`-${delta("otherCurrent")}`),
      },
      {
        key: "iAp",
        label: "+ Variación de proveedores",
        fmt: "money",
        cell: () => fx(delta("payables")),
      },
      {
        key: "iTax",
        label: "+ Variación de impuestos por pagar",
        fmt: "money",
        cell: () => fx(delta("taxPayable")),
      },
      {
        key: "iOcl",
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
        key: "indirect",
        label: "Flujo de operación (indirecto)",
        fmt: "money",
        kind: "total",
        cell: () => fx(`SUM(B${R.iNet}:B${R.iAdj})`),
      },
      {
        key: "iFinal",
        label: "Saldo final de efectivo (indirecto)",
        fmt: "money",
        kind: "total",
        cell: () =>
          fx(`${B("initial")}+${B("indirect")}+${B("inv")}+${B("fin")}`),
      },
    );
  }
  items.push(
    { kind: "blank" },
    { kind: "section", label: "CONCILIACIÓN" },
    {
      key: "bal",
      label: "Efectivo en balance actual",
      fmt: "money",
      cell: () => lnk(A("cash", current)),
    },
    {
      key: "dBal",
      label: "Diferencia directo − balance",
      fmt: "money",
      cell: () => fx(`${B("final")}-${B("bal")}`),
    },
  );
  if (prev)
    items.push({
      key: "dMeth",
      label: "Diferencia operación directa − indirecta",
      fmt: "money",
      cell: () => fx(`${B("op")}-${B("indirect")}`),
    });
  ({ R } = layout(items, last + 2));
  writeItems(ws, items, ["B"], fmt);
  freeze(ws, 1, 5);
}

/* ───────────────────────── hoja: Presupuesto maestro y caja ───────────────────────── */

function buildBudget(wb, data, fmt, ef, { current }) {
  const b = data.budget,
    linked = b.linked,
    p = current;
  const M = b.months;
  const ws = makeSheet(
    wb,
    "cash",
    "Presupuesto maestro y de caja",
    linked
      ? `Vinculado a ${data.periods[p].label}. El crédito se cobra/paga al mes siguiente. Supuestos generales a la derecha de la tabla.`
      : "Supuestos manuales. El crédito se cobra/paga al mes siguiente. Supuestos generales a la derecha de la tabla.",
    [46, ...M.map(() => 16), 18, 3, 40, 18],
  );
  // Bloque de supuestos a la derecha de la tabla mensual: así la cabecera de
  // meses queda en la fila 5 y se puede inmovilizar sin bloquear media pantalla.
  const supLabelCol = M.length + 4;
  const supCol = colLetter(M.length + 5);
  let A;
  const S = (k) => `${supCol}${A[k]}`;
  const E = (k) => ef.cell(k, p);
  const sup = (key, label, f, cell, note) => ({
    key,
    label,
    fmt: f,
    note,
    cell: (c, i) => (i ? null : cell()),
  });
  const assumptions = [
    { kind: "section", label: "SUPUESTOS GENERALES" },
    sup("price", "Precio de venta unitario", "money", () =>
      inp(inputValue(b.price)),
    ),
    sup("cost", "Costo unitario de compra", "money", () =>
      inp(inputValue(b.cost)),
    ),
    sup("cashPct", "Ventas cobradas en el mes (%)", "rate", () =>
      inp(inputValue(b.cashPct)),
    ),
    sup("payPct", "Compras pagadas en el mes (%)", "rate", () =>
      inp(inputValue(b.payPct)),
    ),
    sup("taxRate", "Impuesto supuesto (%)", "rate", () =>
      linked ? lnk(E("taxRate")) : inp(inputValue(b.taxRate)),
    ),
    sup("minimum", "Saldo mínimo de caja", "money", () =>
      inp(inputValue(b.minimum)),
    ),
    sup("initUnits", "Inventario inicial (unidades)", "units", () =>
      linked
        ? lnk(`IFERROR(${ef.acc("inventory", p)}/${S("cost")},0)`)
        : inp(inputValue(b.initialUnits)),
    ),
    sup("initCash", "Saldo inicial de caja", "money", () =>
      linked ? lnk(ef.acc("cash", p)) : inp(inputValue(b.initialCash)),
    ),
    sup("ar", "Cuentas por cobrar iniciales", "money", () =>
      linked ? lnk(ef.acc("receivables", p)) : inp(inputValue(b.receivables)),
    ),
    sup("ap", "Cuentas por pagar iniciales", "money", () =>
      linked ? lnk(ef.acc("payables", p)) : inp(inputValue(b.payables)),
    ),
  ];
  if (linked)
    assumptions.push(
      sup("span", "Meses del período base", "int", () =>
        lnk(`MAX(1,${E("months")})`),
      ),
      sup("baseUnits", "Unidades mensuales del período base", "units", () =>
        lnk(`IFERROR(${E("sales")}/${S("span")}/${S("price")},0)`),
      ),
    );
  ({ R: A } = layout(assumptions, 5));
  const tableStart = 5;
  writeItems(ws, assumptions, [supCol], fmt, { labelCol: supLabelCol });

  // Tabla mensual: columnas B.. por mes + columna de total.
  const cols = [...M.map((_, i) => colLetter(i + 2)), colLetter(M.length + 2)];
  const T = M.length; // índice de la columna total
  let R;
  const at = (k, c) => `${c}${R[k]}`;
  const prevCol = (i) => cols[i - 1];
  /**
   * monthly(key, label, fmt, formulaFor(c, i), total)
   * total: "sum" | "first" | "last" | null
   */
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
  const linkedOr = (field, efKey) => (c, i) =>
    linked ? lnk(`${E(efKey)}/${S("span")}`) : inp(inputValue(M[i][field]));
  const items = [
    {
      kind: "header",
      label: "Concepto",
      headers: [...M.map((m, i) => m.label || `Mes ${i + 1}`), "Total / saldo"],
    },
    { kind: "section", label: "SUPUESTOS MENSUALES" },
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
            `${i ? at("units", prevCol(i)) : S("baseUnits")}*(1+${at("growth", c)}/100)`,
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
      linkedOr("expense", "opex"),
    ),
    monthly(
      "dep",
      "Depreciación",
      "money",
      linkedOr("depreciation", "depreciation"),
    ),
    monthly("interest", "Intereses", "money", linkedOr("interest", "interest")),
    monthly("otherOut", "Otras salidas de caja", "money", mInput("otherOut")),
    monthly("otherIn", "Otras entradas de caja", "money", mInput("otherIn")),
    { kind: "section", label: "PRESUPUESTO DE VENTAS" },
    monthly(
      "sales",
      "Ventas",
      "money",
      (c) => fx(`${at("units", c)}*${S("price")}`),
      "sum",
      "total",
    ),
    monthly(
      "arEnd",
      "Ventas a crédito pendientes",
      "money",
      (c) => fx(`${at("sales", c)}*(1-${S("cashPct")}/100)`),
      "last",
    ),
    { kind: "section", label: "COMPRAS, INVENTARIOS Y COSTO DE VENTAS" },
    monthly(
      "openU",
      "Inventario inicial (unidades)",
      "units",
      (c, i) => fx(i ? at("closeU", prevCol(i)) : S("initUnits")),
      "first",
    ),
    monthly(
      "needU",
      "Necesidad: ventas + deseado − inicial",
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
      "Compras",
      "money",
      (c) => fx(`${at("buyU", c)}*${S("cost")}`),
      "sum",
      "total",
    ),
    monthly(
      "apEnd",
      "Compras a crédito pendientes",
      "money",
      (c) => fx(`${at("purchases", c)}*(1-${S("payPct")}/100)`),
      "last",
    ),
    monthly(
      "openV",
      "Inventario inicial valorado",
      "money",
      (c) => fx(`${at("openU", c)}*${S("cost")}`),
      "first",
    ),
    monthly(
      "closeV",
      "Inventario final valorado",
      "money",
      (c) => fx(`${at("closeU", c)}*${S("cost")}`),
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
    { kind: "section", label: "ESTADO DE RESULTADOS PRESUPUESTADO" },
    monthly("gross", "Utilidad bruta", "money", (c) =>
      fx(`${at("sales", c)}-${at("cogs", c)}`),
    ),
    monthly("ebit", "UAII", "money", (c) =>
      fx(`${at("gross", c)}-${at("expense", c)}-${at("dep", c)}`),
    ),
    monthly("ebt", "Utilidad antes de impuestos", "money", (c) =>
      fx(`${at("ebit", c)}-${at("interest", c)}`),
    ),
    monthly("tax", "Impuestos", "money", (c) =>
      fx(`MAX(0,${at("ebt", c)})*${S("taxRate")}/100`),
    ),
    monthly(
      "net",
      "Utilidad neta",
      "money",
      (c) => fx(`${at("ebt", c)}-${at("tax", c)}`),
      "sum",
      "total",
    ),
    { kind: "section", label: "PRESUPUESTO DE CAJA" },
    monthly(
      "openCash",
      "Saldo inicial",
      "money",
      (c, i) => fx(i ? at("closeCash", prevCol(i)) : S("initCash")),
      "first",
    ),
    monthly("curCol", "Cobros de ventas del mes", "money", (c) =>
      fx(`${at("sales", c)}*${S("cashPct")}/100`),
    ),
    monthly("prevCol", "Cobros de ventas del mes anterior", "money", (c, i) =>
      fx(i ? at("arEnd", prevCol(i)) : S("ar")),
    ),
    monthly(
      "collections",
      "Total cobros a clientes",
      "money",
      (c) => fx(`${at("curCol", c)}+${at("prevCol", c)}`),
      "sum",
      "total",
    ),
    monthly("cashIn", "Otras entradas", "money", (c) => fx(at("otherIn", c))),
    monthly("curPay", "Pagos de compras del mes", "money", (c) =>
      fx(`${at("purchases", c)}*${S("payPct")}/100`),
    ),
    monthly("prevPay", "Pagos de compras del mes anterior", "money", (c, i) =>
      fx(i ? at("apEnd", prevCol(i)) : S("ap")),
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
      "Gastos, intereses, impuestos y otras salidas",
      "money",
      (c) =>
        fx(
          `${at("expense", c)}+${at("interest", c)}+${at("tax", c)}+${at("otherOut", c)}`,
        ),
    ),
    monthly(
      "closeCash",
      "Saldo final de caja",
      "money",
      (c) =>
        fx(
          `${at("openCash", c)}+${at("collections", c)}+${at("cashIn", c)}-${at("payments", c)}-${at("outTotal", c)}`,
        ),
      "last",
      "total",
    ),
    monthly(
      "need",
      "Necesidad para alcanzar el mínimo",
      "money",
      (c) => fx(`MAX(0,${S("minimum")}-${at("closeCash", c)})`),
      null,
    ),
  ];
  ({ R } = layout(items, tableStart));
  writeItems(ws, items, cols, fmt);
  // Formato condicional: resalta los meses con necesidad de financiamiento.
  ws.addConditionalFormatting({
    ref: `${cols[0]}${R.need}:${cols[T - 1]}${R.need}`,
    rules: [
      {
        type: "cellIs",
        operator: "greaterThan",
        formulae: ["0"],
        style: {
          font: { color: { argb: "FFB42318" }, bold: true },
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: "FFFDECEA" },
          },
        },
      },
    ],
  });
  // Fila destacada del saldo final de caja + barras de datos azules (rojas si hay déficit).
  for (let c = 1; c <= cols.length + 1; c++) {
    const cell = ws.getRow(R.closeCash).getCell(c);
    cell.font = { bold: true, color: { argb: COLORS.brand } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCE7FA" },
    };
    cell.border = {
      top: { style: "medium", color: { argb: COLORS.brand } },
      bottom: { style: "medium", color: { argb: COLORS.brand } },
    };
  }
  ws.getRow(R.closeCash).height = 24;
  ws.addConditionalFormatting({
    ref: `${cols[0]}${R.closeCash}:${cols[T - 1]}${R.closeCash}`,
    rules: [dataBar(COLORS.brand, "FFD92D20")],
  });
  freeze(ws, 1, tableStart);
}

/* ───────────────────────── API pública ───────────────────────── */

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod.default ?? mod;
}

/**
 * Construye el Workbook (sin descargarlo). Útil en el navegador y en pruebas Node.
 * @param {object} data  Estado completo de la app (useFinance().data)
 * @param {string} section  Clave de EXPORT_SECTIONS
 */
export async function buildWorkbook(data, section = "completo", ExcelJS) {
  ExcelJS ??= await loadExcelJS();
  const spec = EXPORT_SECTIONS[section] ?? EXPORT_SECTIONS.completo;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Finance Manager";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true; // Excel recalcula todo al abrir
  const fmt = formats(data.currency || "C$");
  const current = Math.min(
    Math.max(0, data.selected | 0),
    data.periods.length - 1,
  );
  const previous = current > 0 ? current - 1 : null;
  const ctx = { current, previous, base: previous ?? current };
  const ef = buildStatements(wb, data, fmt);
  const builders = {
    vh: buildAnalysis,
    ratios: buildRatios,
    cvu: buildCvu,
    flow: buildCashFlow,
    cash: buildBudget,
  };
  for (const key of spec.sheets)
    if (builders[key]) builders[key](wb, data, fmt, ef, ctx);
  return wb;
}

/** Genera el archivo y lo descarga en el navegador. */
export async function exportToExcel(data, section = "completo") {
  const spec = EXPORT_SECTIONS[section] ?? EXPORT_SECTIONS.completo;
  const wb = await buildWorkbook(data, section);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
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
