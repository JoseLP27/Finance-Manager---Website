import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { createInitial, blankPeriod } from "../src/lib/finance.js";
import {
  buildWorkbookParts,
  buildXlsx,
  EXPORT_SECTIONS,
  SHEET_NAMES,
} from "../src/services/exportToExcelService.js";

const sample = () => {
  const d = createInitial();
  d.periods[0].label = "2024";
  d.periods.push(blankPeriod("2025"));
  d.selected = 1;
  d.periods[0].balance.cash = 100;
  d.periods[1].balance.cash = 150;
  d.periods[1].income.sales = 1000;
  return d;
};
const rowOf = (ws, label, col = 2) => {
  let found;
  ws.eachRow((row, r) => {
    if (!found && row.getCell(col).value === label) found = r;
  });
  assert.ok(found, `fila «${label}» no encontrada`);
  return found;
};

test("el libro completo sigue la estructura de la plantilla", async () => {
  const { wb } = await buildWorkbookParts(sample(), "completo");
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    Object.values(SHEET_NAMES),
  );
  assert.equal(wb.calcProperties.fullCalcOnLoad, true);
});

test("cada apartado incluye las hojas de las que dependen sus fórmulas", async () => {
  for (const [key, spec] of Object.entries(EXPORT_SECTIONS)) {
    const { wb } = await buildWorkbookParts(sample(), key);
    const names = wb.worksheets.map((w) => w.name);
    if (
      spec.sheets.some(
        (s) => !["portada", "personal", "inventario", "formulas"].includes(s),
      )
    )
      assert.ok(names.includes(SHEET_NAMES.estados), key);
  }
});

test("las fórmulas usan nombres definidos legibles", async () => {
  const { wb, book } = await buildWorkbookParts(sample(), "completo");
  const names = new Set(book.names.map((n) => n.name));
  for (const n of [
    "Ventas_Act",
    "Ventas_Ant",
    "Activo_Corriente_Act",
    "Razon_Corriente",
    "PE_Unidades_Base",
    "FE_Operacion",
    "Caja_Final_Plan",
  ])
    assert.ok(names.has(n), `falta el nombre ${n}`);
  const ef = wb.getWorksheet(SHEET_NAMES.estados);
  assert.equal(
    ef.getCell(`D${rowOf(ef, "Efectivo y equivalentes")}`).value,
    150,
  );
  assert.equal(
    ef.getCell(`D${rowOf(ef, "UTILIDAD BRUTA")}`).value.formula,
    "Ventas_Act-Costo_Ventas_Act",
  );
  const an = wb.getWorksheet(SHEET_NAMES.analisis);
  assert.equal(
    an.getCell(`C${rowOf(an, "Razón corriente")}`).value.formula,
    'IFERROR(Activo_Corriente_Act/Pasivo_Corriente_Act,"N/D")',
  );
});

test("el .xlsx incluye gráficos nativos enlazados a celdas", async () => {
  const zip = await JSZip.loadAsync(await buildXlsx(sample(), "completo"));
  const charts = Object.keys(zip.files).filter((f) =>
    /^xl\/charts\/chart\d+\.xml$/.test(f),
  );
  assert.equal(charts.length, 8);
  const panel = await zip.file("xl/charts/chart1.xml").async("string");
  assert.match(panel, /<c:f>'01_Panel'!\$C\$16:\$D\$16<\/c:f>/);
  const types = await zip.file("[Content_Types].xml").async("string");
  assert.match(types, /\/xl\/charts\/chart1\.xml/);
});

test("las etiquetas del usuario se escriben como texto, no como fórmula", async () => {
  const d = sample();
  d.accounts.push({
    id: "x",
    label: '=HYPERLINK("http://x")',
    group: "current",
  });
  const { wb } = await buildWorkbookParts(d, "estados");
  const ef = wb.getWorksheet(SHEET_NAMES.estados);
  const cell = ef.getCell(`B${rowOf(ef, '=HYPERLINK("http://x")')}`);
  assert.equal(typeof cell.value, "string");
});
