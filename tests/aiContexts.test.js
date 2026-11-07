import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitial,
  defaultAccounts,
  personalTotals,
} from "../src/lib/finance.js";
import {
  contextoEstados,
  contextoRazones,
  contextoCvu,
  contextoEfe,
  contextoPresupuesto,
  contextoPersonal,
  contextoInventario,
  contextoPanel,
  hayDatosEnPeriodo,
} from "../src/services/aiContexts.js";

// Dataset 2025/2026: activos 125,000 → 172,100; pasivos 40,000 → 55,000;
// patrimonio 85,000 → 117,100; ventas 200,000 → 300,000; utilidad 15,400 → 30,100.
function dataset() {
  const d = createInitial();
  d.company = "Empresa de prueba";
  d.currency = "C$";
  d.accounts = structuredClone(defaultAccounts);

  const p2025 = {
    ...d.periods[0],
    label: "2025",
    months: 12,
    balance: {
      cash: 15000,
      receivables: 30000,
      inventory: 25000,
      otherCurrent: 5000,
      equipment: 60000,
      accDep: 10000,
      payables: 20000,
      shortDebt: 10000,
      taxPayable: 5000,
      longDebt: 5000,
      capital: 50000,
      reserves: 10000,
      retained: 25000,
    },
    income: {
      sales: 200000,
      cogs: 120000,
      opex: 48000,
      depreciation: 8000,
      interest: 2000,
      taxRate: 30,
      creditPct: 60,
      creditPurchases: 90000,
    },
  };

  const p2026 = {
    ...d.periods[0],
    id: "periodo-2026",
    label: "2026",
    months: 12,
    balance: {
      cash: 30000,
      receivables: 45000,
      inventory: 32100,
      otherCurrent: 5000,
      equipment: 72000,
      accDep: 15000,
      otherAsset: 3000,
      payables: 28000,
      shortDebt: 12000,
      taxPayable: 8000,
      otherDebt: 2000,
      longDebt: 5000,
      capital: 50000,
      reserves: 15000,
      retained: 52100,
    },
    income: {
      sales: 300000,
      cogs: 175000,
      opex: 67000,
      depreciation: 12000,
      interest: 3000,
      taxRate: 30,
      creditPct: 60,
      creditPurchases: 140000,
    },
  };

  d.periods = [p2025, p2026];
  d.selected = 1;
  return { data: d, p2025, p2026 };
}

test("AI contexts: empty workspace is flagged as unavailable", () => {
  const d = createInitial();
  const ctx = contextoEstados(d, d.periods[0], null);
  assert.equal(ctx.disponible, false);
  assert.equal(hayDatosEnPeriodo(d.periods[0]), false);
});

test("AI contexts: estados financieros include only the kept figures", () => {
  const { data, p2025, p2026 } = dataset();
  const ctx = contextoEstados(data, p2026, p2025);
  assert.equal(ctx.disponible, true);
  assert.equal(ctx.empresa, "Empresa de prueba");
  assert.equal(ctx.moneda, "C$");
  assert.equal(ctx.periodo, "2026");
  assert.equal(ctx.balance.totalActivos, "C$ 172,100.00");
  assert.equal(ctx.balance.totalPasivos, "C$ 55,000.00");
  assert.equal(ctx.balance.patrimonio, "C$ 117,100.00");
  assert.equal(ctx.balance.ecuacionCuadra, true);
  assert.equal(ctx.comparacion.periodoBase, "2025");
  assert.equal(ctx.comparacion.ventas.variacion, "50.00%");
  assert.equal(ctx.comparacion.utilidadNeta.variacion, "95.45%");
  assert.ok(ctx.resultados.some((x) => x.concepto === "Utilidad neta"));
});

test("AI contexts: razones use averaged balances and match ROE", () => {
  const { data, p2025, p2026 } = dataset();
  const ctx = contextoRazones(data, p2026, p2025);
  assert.equal(ctx.disponible, true);
  assert.match(ctx.criterioPromedios, /promedio entre 2025 y 2026/);
  const roe = ctx.rentabilidad.indicadores.find(([k]) => k === "ROE");
  assert.equal(roe[1], "29.79%");
  assert.equal(ctx.promedios.activos, "C$ 148,550.00");
  assert.equal(ctx.promedios.patrimonio, "C$ 101,050.00");
  assert.equal(ctx.dupont.coincide, true);
});

test("AI contexts: C-V-U and presupuesto expose valid summary data", () => {
  const { data, p2026 } = dataset();
  data.cvu = {
    ...data.cvu,
    linked: true,
    units: 10000,
    dividends: 5000,
    shares: 20000,
    scenarioUnits: 11000,
    priceChange: 5,
    costChange: 2,
    fixedChange: 3,
  };
  const cv = contextoCvu(data, p2026);
  assert.equal(cv.disponible, true);
  assert.equal(cv.supuestos.unidades, "10,000.00");
  assert.ok(cv.comparado.length === 8);
  assert.ok(cv.equilibrio.unidadesMinimasEnteras > 0);

  data.budget = {
    ...data.budget,
    linked: false,
    price: 30,
    cost: 17.5,
    initialUnits: 800,
    initialCash: 15000,
    receivables: 25000,
    payables: 20000,
    cashPct: 60,
    payPct: 70,
    taxRate: 30,
    minimum: 5000,
    months: data.budget.months.map((m, i) => ({
      ...m,
      label: `Mes ${i + 1}`,
      units: 1000,
      growth: 0,
      desired: 10,
      expense: 4000,
      depreciation: 1000,
      interest: 500,
      otherOut: 500,
      otherIn: 0,
    })),
  };
  const pr = contextoPresupuesto(data, p2026);
  assert.equal(pr.disponible, true);
  assert.equal(pr.meses.length, 3);
  assert.ok(pr.totales.ventas.startsWith("C$"));
});

test("AI contexts: cash flow, personal and inventory build readable summaries", () => {
  const { data, p2025, p2026 } = dataset();
  data.flow = {
    entries: [
      {
        id: "mov-1",
        periodId: p2026.id,
        label: "Cobro de clientes",
        group: "operating",
        direction: "in",
        amount: 32000,
      },
      {
        id: "mov-2",
        periodId: p2026.id,
        label: "Compra de equipo",
        group: "investing",
        direction: "out",
        amount: 12000,
      },
    ],
    settings: {},
  };
  const cf = contextoEfe(data, p2026, p2025);
  assert.equal(cf.disponible, true);
  assert.equal(cf.movimientos.length, 2);
  assert.ok(cf.conciliacion.length > 5);

  data.personal = [
    { id: "p1", kind: "income", category: "Salario", amount: 20000 },
    { id: "p2", kind: "fixed", category: "Renta", amount: 6000 },
    { id: "p3", kind: "variable", category: "Alimentación", amount: 4000 },
  ];
  const per = contextoPersonal(data);
  assert.equal(per.disponible, true);
  assert.equal(personalTotals(data.personal).balance, 10000);
  assert.equal(per.totales.capacidadAhorro, "50.00%");
  assert.equal(per.distribucionGastos.length, 2);

  data.inventory = [
    {
      id: "i1",
      name: "Producto A",
      initial: 100.5,
      incoming: 20,
      outgoing: 30,
      cost: 12.5,
      minimum: 95,
    },
    {
      id: "i2",
      name: "",
      initial: "",
      incoming: "",
      outgoing: "",
      cost: "",
      minimum: "",
    },
  ];
  const inv = contextoInventario(data);
  assert.equal(inv.disponible, true);
  assert.equal(inv.productos.length, 2);
  assert.equal(inv.productos[0].existenciaFinal, "90.50");
  assert.equal(inv.productos[0].estado, "Por debajo del mínimo");
  assert.equal(inv.productos[1].producto, "(sin nombre)");
  assert.equal(inv.productos[1].existenciaInicial, "0.00");
});

test("AI contexts: panel summary connects modules for the selected period", () => {
  const { data, p2025, p2026 } = dataset();
  const ctx = contextoPanel(data, p2026, p2025);
  assert.equal(ctx.disponible, true);
  assert.equal(ctx.resumen.balanceCuadra, true);
  assert.equal(ctx.resumen.roe, "29.79%");
  assert.deepEqual(ctx.periodosRegistrados, ["2025", "2026"]);
});
