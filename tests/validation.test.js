import test from "node:test";
import assert from "node:assert/strict";
import { createInitial } from "../src/lib/finance.js";
import { validateData } from "../src/lib/validation.js";
test("A clean workspace and a full financial backup round-trip", () => {
  const d = createInitial();
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))), d);
  d.flow.entries.push({
    id: "entry",
    periodId: d.periods[0].id,
    label: "Cobro",
    group: "operating",
    direction: "in",
    amount: 100,
  });
  d.flow.settings[d.periods[0].id] = { initialCash: 0, adjustments: -10 };
  assert.equal(validateData(d), d);
});
test("Malformed values and missing collection structures are rejected", () => {
  for (const mutate of [
    (d) => {
      d.personal = [{}];
    },
    (d) => {
      d.inventory = [{}];
    },
    (d) => {
      d.flow.settings = null;
    },
    (d) => {
      d.periods[0].months = 1.2;
    },
    (d) => {
      d.budget.cashPct = 101;
    },
    (d) => {
      d.periods[0].income.sales = "invalid";
    },
    (d) => {
      d.cvu.units = -1;
    },
    (d) => {
      d.selected = 99;
    },
    (d) => {
      d.accounts.push(d.accounts[0]);
    },
  ]) {
    const d = createInitial();
    mutate(d);
    assert.throws(() => validateData(d));
  }
});
test("Prototype keys and orphan cash-flow movements are rejected", () => {
  const d = createInitial();
  d.flow.entries.push({
    id: "entry",
    periodId: "missing",
    label: "Cobro",
    group: "operating",
    direction: "in",
    amount: 100,
  });
  assert.throws(() => validateData(d));
  assert.throws(() =>
    validateData(JSON.parse('{"__proto__": {"polluted": true}}')),
  );
});
