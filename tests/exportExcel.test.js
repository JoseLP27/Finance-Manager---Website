import test from "node:test";
import assert from "node:assert/strict";
import { createInitial, blankPeriod } from "../src/lib/finance.js";
import {
  buildWorkbook,
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
const rowOf = (ws, label) => {
  let found;
  ws.eachRow((row, r) => {
    if (!found && row.getCell(1).value === label) found = r;
  });
  assert.ok(found, `fila «${label}» no encontrada`);
  return found;
};

test("el libro completo contiene todas las hojas", async () => {
  const wb = await buildWorkbook(sample(), "completo");
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    Object.values(SHEET_NAMES),
  );
  assert.equal(wb.calcProperties.fullCalcOnLoad, true);
});

test("cada apartado incluye la hoja de datos de la que dependen sus fórmulas", async () => {
  for (const key of Object.keys(EXPORT_SECTIONS)) {
    const wb = await buildWorkbook(sample(), key);
    assert.equal(wb.worksheets[0].name, SHEET_NAMES.ef, key);
  }
});

test("los datos son valores y los cálculos son fórmulas nativas", async () => {
  const wb = await buildWorkbook(sample(), "completo");
  const ef = wb.getWorksheet(SHEET_NAMES.ef);
  assert.equal(
    ef.getCell(`C${rowOf(ef, "Efectivo y equivalentes")}`).value,
    150,
  );
  const total = ef.getCell(`C${rowOf(ef, "TOTAL ACTIVOS")}`).value;
  assert.ok(total.formula, "TOTAL ACTIVOS debe ser fórmula");

  const vh = wb.getWorksheet(SHEET_NAMES.vh);
  const r = rowOf(vh, "Efectivo y equivalentes");
  assert.equal(vh.getCell(`F${r}`).value.formula, `C${r}-B${r}`);
  assert.match(
    vh.getCell(`B${r}`).value.formula,
    /^'Estados Financieros'!\$B\$\d+$/,
  );

  const ratios = wb.getWorksheet(SHEET_NAMES.ratios);
  const current = ratios.getCell(`C${rowOf(ratios, "Razón corriente")}`).value;
  assert.match(current.formula, /'Estados Financieros'!/);
});

test("las etiquetas del usuario se escriben como texto, no como fórmula", async () => {
  const d = sample();
  d.accounts.push({
    id: "x",
    label: '=HYPERLINK("http://x")',
    group: "current",
  });
  const wb = await buildWorkbook(d, "estados");
  const ef = wb.getWorksheet(SHEET_NAMES.ef);
  const cell = ef.getCell(`A${rowOf(ef, '=HYPERLINK("http://x")')}`);
  assert.equal(typeof cell.value, "string");
});
