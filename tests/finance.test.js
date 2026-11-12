import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitial,
  blankPeriod,
  defaultAccounts,
  statements,
  ratios,
  cvu,
  cvuInputs,
  plan,
  cashFlow,
  personalTotals,
  stock,
  divide,
  change,
} from "../src/lib/finance.js";
const close = (a, b, tolerance = 1e-8) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);

test("Fresh workspace has no predefined financial records or amounts", () => {
  const d = createInitial();
  assert.deepEqual(d.periods[0].balance, {});
  assert.deepEqual(d.periods[0].income, {});
  assert.equal(d.company, "");
  assert.equal(d.personal.length, 0);
  assert.equal(d.inventory.length, 0);
  assert.equal(d.flow.entries.length, 0);
  assert.equal(d.budget.price, "");
});
test("TOR: both leverage methods, EPS, and break-even match the class key", () => {
  const input = {
    units: 100000,
    price: 7.5,
    variable: 3,
    fixed: 250000,
    interest: 80000,
    dividends: 40000,
    shares: 20000,
    taxRate: 40,
  };
  const base = cvu(input),
    next = cvu({ ...input, units: 120000 });
  close(base.sales, 750000);
  close(base.ebit, 200000);
  close(base.net, 72000);
  close(base.eps, 1.6);
  close(next.eps, 4.3);
  close(base.q, 55555.555555555555);
  close(base.breakEvenMoney, 416666.6666666667);
  close(base.gao, 2.25);
  close(base.gaf, 3.75);
  close(base.gat, 8.4375);
  close(
    divide(change(next.ebit, base.ebit), change(next.sales, base.sales)),
    base.gao,
  );
  close(
    divide(change(next.eps, base.eps), change(next.ebit, base.ebit)),
    base.gaf,
  );
  close(
    divide(change(next.eps, base.eps), change(next.sales, base.sales)),
    base.gat,
  );
  close(cvu({ ...input, units: base.q }).ebit, 0);
});
test("Bartlett: average balances and 365-day activity ratios", () => {
  const prev = blankPeriod("2011"),
    p = blankPeriod("2012");
  prev.balance = {
    inventory: 300000,
    receivables: 365000,
    payables: 270000,
    equipment: 2266000,
    otherCurrent: 339000,
  };
  p.balance = {
    cash: 431000,
    inventory: 289000,
    receivables: 503000,
    payables: 382000,
    otherDebt: 238000,
    equipment: 2374000,
  };
  p.income = {
    sales: 3074000,
    cogs: 2088000,
    creditPct: 100,
    creditPurchases: 1461600,
  };
  const r = ratios(p, prev, defaultAccounts);
  close(r.ctn, 603000);
  close(r.current, 1223000 / 620000);
  close(r.acid, 934000 / 620000);
  close(r.inventoryDays, (294500 * 365) / 2088000);
  close(r.collectionDays, (434000 * 365) / 3074000);
  close(r.paymentDays, (326000 * 365) / 1461600);
  close(r.fixedRotation, 3074000 / 2320000);
  close(r.turnover, 3074000 / 3433500);
});
test("DuPont cancels to direct ROE using consistent averages", () => {
  const p = blankPeriod();
  p.balance = { cash: 100000, capital: 60000, longDebt: 40000 };
  p.income = { sales: 200000, cogs: 188000 };
  const r = ratios(p, null, defaultAccounts);
  close(r.margin, 0.06);
  close(r.turnover, 2);
  close(r.multiplier, 5 / 3);
  close(r.dupont, 0.2);
  close(r.dupont, r.roe);
  close(r.roa, 0.12);
});
test("Electrónicas balance and horizontal change preserve source units ($ thousands)", () => {
  const p = blankPeriod();
  p.balance = {
    cash: 1170,
    investments: 158,
    receivables: 6440,
    inventory: 8475,
    otherCurrent: 2332,
    equipment: 3414,
    accDep: 618,
    otherAsset: 6765,
    shortDebt: 2274,
    payables: 279,
    otherDebt: 1912,
    longDebt: 8971,
    capital: 2000,
    reserves: 1543,
    retained: 11157,
  };
  const s = statements(p, defaultAccounts);
  close(s.current, 18575);
  close(s.assets, 28136);
  close(s.liabilities, 13436);
  close(s.equity, 14700);
  close(s.difference, 0);
  close(change(s.assets, 17255), 10881 / 17255);
});
function manualPlan() {
  const d = createInitial();
  d.budget.linked = false;
  return d;
}
test("El Progreso: purchases, COGS and budgeted profit match class", () => {
  const d = manualPlan(),
    b = d.budget;
  Object.assign(b, { price: 600, cost: 350, initialUnits: 30, taxRate: 30 });
  b.months.forEach((m, i) =>
    Object.assign(m, {
      units: [120, 150, 180][i],
      desired: [30, 36, 40][i],
      expense: 18500 + i * 500,
      depreciation: 500,
      interest: 1000,
    }),
  );
  const r = plan(b, d.periods[0], d.accounts);
  assert.deepEqual(
    r.rows.map((x) => x.purchases),
    [42000, 54600, 64400],
  );
  assert.deepEqual(
    r.rows.map((x) => x.cogs),
    [42000, 52500, 63000],
  );
  assert.deepEqual(
    r.rows.map((x) => x.net),
    [7000, 11900, 16800],
  );
  close(r.totals.net, 35700);
  b.months[2].desired = 60;
  const changed = plan(b, d.periods[0], d.accounts);
  close(changed.rows[2].purchases, 71400);
  close(changed.rows[2].cogs, 63000);
});
test("San Rafael: collections, payments and rolling cash reproduce the presentation", () => {
  const d = manualPlan(),
    b = d.budget;
  Object.assign(b, {
    price: 500,
    cost: 300,
    initialUnits: 20,
    initialCash: 5000,
    cashPct: 60,
    payPct: 50,
    taxRate: 30,
    minimum: 5000,
  });
  b.months.forEach((m, i) =>
    Object.assign(m, {
      units: 100 + 20 * i,
      desired: 24 + 4 * i,
      expense: 9000 + 500 * i,
      depreciation: 500,
      interest: 500,
    }),
  );
  const r = plan(b, d.periods[0], d.accounts);
  assert.deepEqual(
    r.rows.map((x) => x.purchases),
    [31200, 37200, 43200],
  );
  assert.deepEqual(
    r.rows.map((x) => x.collections),
    [30000, 56000, 66000],
  );
  assert.deepEqual(
    r.rows.map((x) => x.payments),
    [15600, 34200, 40200],
  );
  assert.deepEqual(
    r.rows.map((x) => x.closingCash),
    [6900, 14650, 24850],
  );
  b.cashPct = 0;
  const deficit = plan(b, d.periods[0], d.accounts);
  assert.ok(deficit.rows[0].closingCash < 0);
  assert.ok(deficit.rows[0].need > 0);
});
test("Cash flow direct and indirect reconcile and entries stay with their period", () => {
  const d = createInitial(),
    prev = d.periods[0],
    p = blankPeriod("Final");
  d.flow.linked = false; // movimientos registrados manualmente
  prev.balance = { cash: 25000 };
  p.balance = { cash: 52000, receivables: 6000 };
  p.income = {
    sales: 126000,
    cogs: 65000,
    opex: 28000,
    depreciation: 4000,
    taxRate: (7000 / 29000) * 100,
  };
  d.flow.entries = [
    ["operating", "in", 120000],
    ["operating", "out", 65000],
    ["operating", "out", 20000],
    ["operating", "out", 8000],
    ["operating", "out", 7000],
    ["investing", "in", 5000],
    ["investing", "out", 18000],
    ["financing", "in", 30000],
    ["financing", "out", 10000],
  ].map(([group, direction, amount]) => ({
    group,
    direction,
    amount,
    periodId: p.id,
  }));
  d.flow.entries.push({
    group: "operating",
    direction: "in",
    amount: 999999,
    periodId: prev.id,
  });
  const f = cashFlow(d.flow, p, prev, d.accounts);
  close(f.operating, 20000);
  close(f.indirect, 20000);
  close(f.investing, -13000);
  close(f.financing, 20000);
  close(f.final, 52000);
  close(f.reconciliation, 0);
});
test("Shared data edits recalculate ratios, CVU and linked planning", () => {
  const d = createInitial(),
    p = d.periods[0];
  p.balance = { cash: 1000, inventory: 1000, capital: 2000 };
  p.income = {
    sales: 12000,
    cogs: 6000,
    opex: 1200,
    interest: 120,
    taxRate: 30,
  };
  Object.assign(d.cvu, { units: 100 });
  Object.assign(d.budget, { price: 100, cost: 50 });
  const before = plan(d.budget, p, d.accounts);
  p.income.sales = 24000;
  const after = plan(d.budget, p, d.accounts);
  assert.ok(after.rows[0].sales > before.rows[0].sales);
  close(cvuInputs(d.cvu, statements(p, d.accounts)).price, 240);
  close(ratios(p, null, d.accounts).turnover, 12);
});
test("Boundary handling: undefined ratios, no break-even, losses, excess stock", () => {
  assert.equal(divide(1, 0), null);
  assert.equal(divide(null, 1), null);
  assert.equal(change(10, 0), null);
  const input = {
    units: 10,
    price: 5,
    variable: 6,
    fixed: 100,
    interest: 0,
    taxRate: 30,
    dividends: 0,
    shares: 0,
  };
  assert.equal(cvu(input).q, null);
  assert.equal(cvu(input).eps, null);
  assert.equal(cvu(input).tax, 0);
  assert.equal(cvu({ ...input, taxRate: 100 }).gaf, null);
  const d = manualPlan();
  Object.assign(d.budget, { price: 10, cost: 5, initialUnits: 100 });
  d.budget.months[0].units = 10;
  const r = plan(d.budget, d.periods[0], d.accounts);
  close(r.rows[0].purchases, 0);
  close(r.rows[0].closingUnits, 90);
  close(r.rows[0].cogs, 50);
});
test("Personal budget and stock calculations remain independent", () => {
  const p = personalTotals([
    { kind: "income", amount: 10000 },
    { kind: "fixed", amount: 5000 },
    { kind: "variable", amount: 2000 },
  ]);
  close(p.balance, 3000);
  close(p.savings, 0.3);
  assert.equal(personalTotals([]).savings, null);
  const s = stock({
    initial: 10,
    incoming: 5,
    outgoing: 13,
    cost: 100,
    minimum: 3,
  });
  assert.equal(s.quantity, 2);
  assert.equal(s.value, 200);
  assert.equal(s.low, true);
  assert.equal(stock({ initial: 0, incoming: 0, outgoing: 1 }).invalid, true);
});

test("Linked cash flow derives every activity from the statements and ties to the balance", () => {
  const d = createInitial();
  assert.equal(d.flow.linked, true);
  d.accounts.push(
    { id: "prepaid", label: "Anticipos", group: "current" },
    { id: "bonds", label: "Bonos por pagar", group: "longDebt" },
  );
  const prev = d.periods[0],
    p = blankPeriod("2025");
  d.periods.push(p);
  // Balance anterior cuadrado.
  prev.balance = {
    cash: 120000,
    investments: 10000,
    receivables: 85000,
    inventory: 140000,
    equipment: 400000,
    accDep: 90000,
    payables: 70000,
    shortDebt: 30000,
    taxPayable: 8000,
    longDebt: 150000,
    capital: 300000,
    reserves: 20000,
    retained: 87000,
  };
  p.income = {
    sales: 1000000,
    cogs: 600000,
    opex: 190000,
    depreciation: 30000,
    otherIncome: -2000,
    interest: 14000,
    taxRate: 30,
  };
  const net = statements(p, d.accounts).net;
  // Balance actual: utilidades retenidas = anteriores + utilidad − dividendos 20,000; efectivo como cifra de cuadre.
  p.balance = {
    investments: 12000,
    receivables: 95000,
    inventory: 160000,
    otherCurrent: 3000,
    prepaid: 4000,
    equipment: 450000,
    accDep: 120000,
    payables: 80000,
    shortDebt: 25000,
    taxPayable: 9000,
    otherDebt: 2000,
    longDebt: 140000,
    bonds: 50000,
    capital: 320000,
    reserves: 25000,
    retained: 87000 - 5000 + net - 20000,
  };
  const s0 = statements(p, d.accounts);
  p.balance.cash = s0.liabilities + s0.equity - s0.assets;
  assert.ok(Math.abs(statements(p, d.accounts).difference) < 1e-9);

  const f = cashFlow(d.flow, p, prev, d.accounts);
  assert.equal(f.linked, true);
  close(f.reconciliation, 0);
  close(f.final, p.balance.cash);
  close(f.indirectFinal, p.balance.cash);
  close(f.lines.investing.find((l) => l.key === "capex").value, -50000);
  close(f.lines.financing.find((l) => l.key === "dividends").value, -20000);
  close(f.lines.financing.find((l) => l.key === "longDebt").value, 40000);
  close(f.lines.operating.find((l) => l.key === "customWc").value, -4000);
  // Sin período anterior, se usan los movimientos manuales.
  assert.equal(cashFlow(d.flow, prev, undefined, d.accounts).linked, false);
});
