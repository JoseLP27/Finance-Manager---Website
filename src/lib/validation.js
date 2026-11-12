// Validate all user-controlled backup data before replacing the current workspace.
export function validateData(data) {
  const fail = () => {
    throw Error(
      "El archivo no es un respaldo válido de Finance Manager. Revisa su estructura y valores.",
    );
  };
  const obj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const text = (v) => typeof v === "string" && v.length <= 2000;
  const numeric = (v, min = -1e15, max = 1e15) =>
    v === "" ||
    (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);
  const id = (v) =>
    typeof v === "string" &&
    v.length > 0 &&
    v.length < 100 &&
    !["__proto__", "constructor", "prototype"].includes(v);
  const list = (v) => Array.isArray(v) && v.length <= 2000;
  const unique = (rows) => new Set(rows.map((r) => r.id)).size === rows.length;
  const walk = (v, depth = 0) => {
    if (depth > 15) fail();
    if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(k)) fail();
        walk(x, depth + 1);
      }
  };
  walk(data);
  if (
    !obj(data) ||
    data.version !== 1 ||
    !text(data.company) ||
    !["C$", "$"].includes(data.currency) ||
    !list(data.accounts) ||
    !data.accounts.length ||
    !list(data.periods) ||
    !data.periods.length ||
    data.periods.length > 120 ||
    !Number.isInteger(data.selected) ||
    data.selected < 0 ||
    data.selected >= data.periods.length
  )
    fail();
  const groups = [
    "current",
    "fixed",
    "otherAsset",
    "currentDebt",
    "longDebt",
    "equity",
  ];
  for (const a of data.accounts)
    if (!obj(a) || !id(a.id) || !text(a.label) || !groups.includes(a.group))
      fail();
  if (!unique(data.accounts) || !unique(data.periods)) fail();
  const accountIds = new Set(data.accounts.map((a) => a.id));
  for (const p of data.periods) {
    if (
      !obj(p) ||
      !id(p.id) ||
      !text(p.label) ||
      !Number.isInteger(p.months) ||
      p.months < 1 ||
      p.months > 12 ||
      !obj(p.balance) ||
      !obj(p.income)
    )
      fail();
    for (const [k, v] of Object.entries(p.balance))
      if (!accountIds.has(k) || !numeric(v)) fail();
    for (const [k, v] of Object.entries(p.income))
      if (
        !numeric(
          v,
          k === "otherIncome" ? -1e15 : 0,
          ["taxRate", "creditPct"].includes(k) ? 100 : 1e15,
        )
      )
        fail();
  }
  if (
    !obj(data.cvu) ||
    typeof data.cvu.linked !== "boolean" ||
    !obj(data.budget) ||
    typeof data.budget.linked !== "boolean"
  )
    fail();
  for (const [k, v] of Object.entries(data.cvu))
    if (
      k !== "linked" &&
      !numeric(
        v,
        ["priceChange", "costChange", "fixedChange"].includes(k) ? -100 : 0,
        k === "taxRate" ? 100 : 1e15,
      )
    )
      fail();
  for (const [k, v] of Object.entries(data.budget))
    if (
      !["linked", "months"].includes(k) &&
      !numeric(v, 0, ["cashPct", "payPct", "taxRate"].includes(k) ? 100 : 1e15)
    )
      fail();
  if (
    !list(data.budget.months) ||
    !data.budget.months.length ||
    !unique(data.budget.months)
  )
    fail();
  for (const m of data.budget.months) {
    if (!obj(m) || !id(m.id) || !text(m.label)) fail();
    for (const [k, v] of Object.entries(m))
      if (
        !["id", "label"].includes(k) &&
        !numeric(v, k === "growth" ? -100 : 0)
      )
        fail();
  }
  if (
    !obj(data.flow) ||
    !list(data.flow.entries) ||
    !obj(data.flow.settings) ||
    (data.flow.linked !== undefined && typeof data.flow.linked !== "boolean") ||
    !unique(data.flow.entries)
  )
    fail();
  const periodIds = new Set(data.periods.map((p) => p.id));
  for (const e of data.flow.entries)
    if (
      !obj(e) ||
      !id(e.id) ||
      !text(e.label) ||
      !periodIds.has(e.periodId) ||
      !["operating", "investing", "financing"].includes(e.group) ||
      !["in", "out"].includes(e.direction) ||
      !numeric(e.amount, 0)
    )
      fail();
  for (const [k, v] of Object.entries(data.flow.settings))
    if (
      !periodIds.has(k) ||
      !obj(v) ||
      Object.entries(v).some(
        ([k, n]) =>
          !["initialCash", "adjustments"].includes(k) ||
          !numeric(n, k === "initialCash" ? 0 : -1e15),
      )
    )
      fail();
  if (
    !list(data.personal) ||
    !list(data.inventory) ||
    !unique(data.personal) ||
    !unique(data.inventory)
  )
    fail();
  for (const p of data.personal)
    if (
      !obj(p) ||
      !id(p.id) ||
      !text(p.category) ||
      !["income", "fixed", "variable"].includes(p.kind) ||
      !numeric(p.amount, 0)
    )
      fail();
  for (const p of data.inventory) {
    if (!obj(p) || !id(p.id) || !text(p.name)) fail();
    for (const [k, v] of Object.entries(p))
      if (!["id", "name"].includes(k) && !numeric(v, 0)) fail();
  }
  return data;
}
