// Pure financial functions. Preserve full precision until formatting for display.
export const num = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
export const divide = (a, b) =>
  a == null || b == null || b === 0 ? null : a / b;
export const change = (current, previous) =>
  divide(current - previous, previous);
export const sum = (values) =>
  values.reduce((total, value) => total + num(value), 0);
export const product = (values) =>
  values.some((v) => v == null) ? null : values.reduce((a, b) => a * b, 1);
export const accountGroups = {
  current: "Activo corriente",
  fixed: "Activo fijo neto",
  otherAsset: "Otros activos no corrientes",
  currentDebt: "Pasivo corriente",
  longDebt: "Pasivo no corriente",
  equity: "Patrimonio",
};
export const defaultAccounts = [
  ["cash", "Efectivo y equivalentes", "current"],
  ["investments", "Inversiones temporales", "current"],
  ["receivables", "Cuentas por cobrar", "current"],
  ["inventory", "Inventarios", "current"],
  ["otherCurrent", "Otros activos corrientes", "current"],
  ["equipment", "Propiedad, planta y equipo", "fixed"],
  ["accDep", "Depreciación acumulada (resta)", "fixed"],
  ["otherAsset", "Otros activos no corrientes", "otherAsset"],
  ["payables", "Cuentas por pagar a proveedores", "currentDebt"],
  ["shortDebt", "Deuda financiera a corto plazo", "currentDebt"],
  ["taxPayable", "Impuestos por pagar", "currentDebt"],
  ["otherDebt", "Otros pasivos corrientes", "currentDebt"],
  ["longDebt", "Deuda a largo plazo", "longDebt"],
  ["capital", "Capital social", "equity"],
  ["reserves", "Reservas", "equity"],
  ["retained", "Utilidades retenidas y del ejercicio", "equity"],
].map(([id, label, group]) => ({ id, label, group }));
export const incomeFields = [
  ["sales", "Ventas netas"],
  ["cogs", "Costo de ventas"],
  ["opex", "Gastos operativos desembolsables"],
  ["depreciation", "Depreciación del período"],
  ["otherIncome", "Otros ingresos netos (±)"],
  ["interest", "Intereses"],
  ["taxRate", "Impuesto supuesto (%)"],
  ["creditPct", "Ventas a crédito (%)"],
  ["creditPurchases", "Compras a crédito para razones"],
];
export const blankPeriod = (label = "") => ({
  id: crypto.randomUUID(),
  label,
  months: 12,
  balance: {},
  income: {},
});
export const blankMonth = (label = "") => ({
  id: crypto.randomUUID(),
  label,
  units: "",
  growth: "",
  desired: "",
  expense: "",
  depreciation: "",
  interest: "",
  otherOut: "",
  otherIn: "",
});
export const createInitial = () => ({
  version: 1,
  company: "",
  currency: "C$",
  accounts: structuredClone(defaultAccounts),
  periods: [blankPeriod("Período 1")],
  selected: 0,
  cvu: {
    linked: true,
    units: "",
    price: "",
    variable: "",
    fixed: "",
    interest: "",
    taxRate: "",
    dividends: "",
    shares: "",
    scenarioUnits: "",
    priceChange: "",
    costChange: "",
    fixedChange: "",
  },
  flow: { linked: true, entries: [], settings: {} },
  budget: {
    linked: true,
    price: "",
    cost: "",
    initialUnits: "",
    initialCash: "",
    receivables: "",
    payables: "",
    cashPct: "",
    payPct: "",
    taxRate: "",
    minimum: "",
    months: [blankMonth("Mes 1"), blankMonth("Mes 2"), blankMonth("Mes 3")],
  },
  personal: [],
  inventory: [],
});

export function statements(period, accounts) {
  if (!period) return null;
  const b = period.balance;
  const totals = Object.fromEntries(
    Object.keys(accountGroups).map((group) => [
      group,
      sum(
        accounts
          .filter((a) => a.group === group)
          .map((a) => num(b[a.id]) * (a.id === "accDep" ? -1 : 1)),
      ),
    ]),
  );
  const i = Object.fromEntries(
    incomeFields.map(([key]) => [key, num(period.income[key])]),
  );
  const assets = totals.current + totals.fixed + totals.otherAsset;
  const liabilities = totals.currentDebt + totals.longDebt;
  const gross = i.sales - i.cogs,
    ebit = gross - i.opex - i.depreciation;
  const ebt = ebit + i.otherIncome - i.interest;
  // Academic convention: no automatic tax credit on a loss.
  const tax = (Math.max(0, ebt) * i.taxRate) / 100;
  return {
    ...totals,
    ...i,
    assets,
    liabilities,
    equity: totals.equity,
    difference: assets - liabilities - totals.equity,
    gross,
    ebit,
    ebt,
    tax,
    net: ebt - tax,
  };
}

export function ratios(period, previous, accounts) {
  const s = statements(period, accounts),
    p = statements(previous, accounts);
  const avg = (now, before) =>
    previous ? (num(now) + num(before)) / 2 : num(now);
  const a = avg(s.assets, p?.assets),
    e = avg(s.equity, p?.equity),
    fixed = avg(s.fixed, p?.fixed);
  const inv = avg(period.balance.inventory, previous?.balance.inventory);
  const ar = avg(period.balance.receivables, previous?.balance.receivables),
    ap = avg(period.balance.payables, previous?.balance.payables);
  const inventoryRotation = divide(s.cogs, inv),
    arRotation = divide((s.sales * s.creditPct) / 100, ar),
    apRotation = divide(s.creditPurchases, ap);
  const margin = divide(s.net, s.sales),
    turnover = divide(s.sales, a),
    multiplier = divide(a, e);
  // A year is 365 days; shorter periods use their annual fraction, without annualizing profits.
  const days = (365 * num(period.months)) / 12;
  return {
    ctn: s.current - s.currentDebt,
    current: divide(s.current, s.currentDebt),
    acid: divide(s.current - num(period.balance.inventory), s.currentDebt),
    inventoryRotation,
    inventoryDays: divide(days, inventoryRotation),
    arRotation,
    collectionDays: divide(days, arRotation),
    apRotation,
    paymentDays: divide(days, apRotation),
    fixedRotation: divide(s.sales, fixed),
    turnover,
    debt: divide(s.liabilities, s.assets),
    debtEquity: divide(s.liabilities, s.equity),
    interestCoverage: divide(s.ebit, s.interest),
    grossMargin: divide(s.gross, s.sales),
    operatingMargin: divide(s.ebit, s.sales),
    margin,
    roa: divide(s.net, a),
    roe: divide(s.net, e),
    multiplier,
    dupont: product([margin, turnover, multiplier]),
    days,
  };
}

export function cvuInputs(config, s) {
  if (!config.linked)
    return Object.fromEntries(
      Object.entries(config).map(([k, v]) => [k, num(v)]),
    );
  const units = num(config.units);
  return {
    ...config,
    units,
    price: divide(s.sales, units),
    variable: divide(s.cogs, units),
    fixed: s.opex + s.depreciation,
    interest: s.interest,
    taxRate: s.taxRate,
    dividends: num(config.dividends),
    shares: num(config.shares),
  };
}
export function cvu(x) {
  if (x.price == null || x.variable == null) return { valid: false };
  const contributionUnit = x.price - x.variable,
    sales = x.units * x.price,
    variableTotal = x.units * x.variable;
  const contribution = sales - variableTotal,
    ebit = contribution - x.fixed,
    ebt = ebit - x.interest;
  const tax = (Math.max(0, ebt) * x.taxRate) / 100,
    net = ebt - tax;
  const eps = divide(net - x.dividends, x.shares);
  const q = contributionUnit > 0 ? divide(x.fixed, contributionUnit) : null;
  const gao = divide(contribution, ebit),
    adjustedDividend = divide(x.dividends, 1 - x.taxRate / 100);
  const gaf =
    adjustedDividend == null
      ? null
      : divide(ebit, ebit - x.interest - adjustedDividend);
  return {
    valid: true,
    contributionUnit,
    sales,
    variableTotal,
    contribution,
    ebit,
    ebt,
    tax,
    net,
    eps,
    q,
    breakEvenMoney: q == null ? null : q * x.price,
    gao,
    gaf,
    gat: product([gao, gaf]),
    safety: divide(x.units - q, x.units),
  };
}

export function cashFlow(flow, period, previous, accounts) {
  const s = statements(period, accounts);
  const settings = flow.settings?.[period.id] || {};
  const activity = (group) =>
    sum(
      flow.entries
        .filter((e) => e.periodId === period.id && e.group === group)
        .map((e) => num(e.amount) * (e.direction === "out" ? -1 : 1)),
    );
  const operating = activity("operating"),
    investing = activity("investing"),
    financing = activity("financing");
  const delta = (key) => num(period.balance[key]) - num(previous?.balance[key]);
  const indirect = previous
    ? s.net +
      s.depreciation -
      delta("receivables") -
      delta("inventory") -
      delta("otherCurrent") +
      delta("payables") +
      delta("taxPayable") +
      delta("otherDebt") +
      num(settings.adjustments)
    : null;
  const initial = previous
    ? num(previous.balance.cash)
    : num(settings.initialCash);
  // Modo vinculado: todo el EFE se deriva de dos balances y el estado de resultados.
  if (flow.linked && previous) {
    const lines = linkedFlowLines(period, previous, accounts);
    const total = (g) => sum(lines[g].map((l) => l.value));
    const op = total("operating"),
      inv = total("investing"),
      fin = total("financing"),
      ind = total("indirect");
    return {
      linked: true,
      lines,
      operating: op,
      investing: inv,
      financing: fin,
      indirect: ind,
      initial,
      net: op + inv + fin,
      final: initial + op + inv + fin,
      indirectFinal: initial + ind + inv + fin,
      delta,
      reconciliation: op - ind,
    };
  }
  return {
    linked: false,
    operating,
    investing,
    financing,
    indirect,
    initial,
    net: operating + investing + financing,
    final: initial + operating + investing + financing,
    indirectFinal:
      indirect == null ? null : initial + indirect + investing + financing,
    delta,
    reconciliation: indirect == null ? null : operating - indirect,
  };
}

/**
 * Especificación del EFE vinculado. Cada línea es una suma de términos:
 *  ["inc", clave, signo]  → partida del estado de resultados del período actual
 *  ["acc", cuenta, signo] → variación de una cuenta del balance (actual − anterior)
 *  ["grp", grupo, signo]  → variación del total de un grupo del balance
 *  ["custom", grupo, signo] → variación de las cuentas agregadas por el usuario en ese grupo
 * La misma especificación genera las fórmulas de Excel, para que ambos coincidan.
 * Cubre todas las cuentas del balance: si ambos balances cuadran, el saldo final
 * del EFE coincide con el efectivo del balance actual.
 */
export function linkedFlowSpec(accounts) {
  const defaults = new Set(defaultAccounts.map((a) => a.id));
  const has = (group) =>
    accounts.some((a) => a.group === group && !defaults.has(a.id));
  const customWc = [
    ...(has("current") ? [["custom", "current", -1]] : []),
    ...(has("currentDebt") ? [["custom", "currentDebt", 1]] : []),
  ];
  const wcLine = customWc.length
    ? [
        {
          key: "customWc",
          label: "Variación de otras cuentas de capital de trabajo",
          terms: customWc,
        },
      ]
    : [];
  return {
    operating: [
      {
        key: "collections",
        label: "Cobros a clientes (ventas − Δ CxC)",
        terms: [
          ["inc", "sales", 1],
          ["acc", "receivables", -1],
        ],
      },
      {
        key: "suppliers",
        label:
          "Pagos a proveedores (costo de ventas + Δ inventario − Δ proveedores)",
        terms: [
          ["inc", "cogs", -1],
          ["acc", "inventory", -1],
          ["acc", "payables", 1],
        ],
      },
      {
        key: "expenses",
        label: "Pagos de gastos operativos (gastos + Δ otros AC − Δ otros PC)",
        terms: [
          ["inc", "opex", -1],
          ["acc", "otherCurrent", -1],
          ["acc", "otherDebt", 1],
        ],
      },
      {
        key: "interest",
        label: "Intereses pagados",
        terms: [["inc", "interest", -1]],
      },
      {
        key: "taxes",
        label: "Impuestos pagados (impuesto − Δ impuestos por pagar)",
        terms: [
          ["inc", "tax", -1],
          ["acc", "taxPayable", 1],
        ],
      },
      {
        key: "otherIncome",
        label: "Otros ingresos netos",
        terms: [["inc", "otherIncome", 1]],
      },
      ...wcLine,
    ],
    investing: [
      {
        key: "capex",
        label: "Compra neta de activo fijo (Δ activo fijo neto + depreciación)",
        terms: [
          ["grp", "fixed", -1],
          ["inc", "depreciation", -1],
        ],
      },
      {
        key: "investments",
        label: "Inversiones temporales (− Δ)",
        terms: [["acc", "investments", -1]],
      },
      {
        key: "otherAsset",
        label: "Otros activos no corrientes (− Δ)",
        terms: [["grp", "otherAsset", -1]],
      },
    ],
    financing: [
      {
        key: "shortDebt",
        label: "Variación de deuda financiera a corto plazo",
        terms: [["acc", "shortDebt", 1]],
      },
      {
        key: "longDebt",
        label: "Variación de pasivo no corriente",
        terms: [["grp", "longDebt", 1]],
      },
      {
        key: "capital",
        label: "Aportes de capital (Δ capital social)",
        terms: [["acc", "capital", 1]],
      },
      {
        key: "dividends",
        label:
          "Dividendos y otros movimientos de patrimonio (Δ resto del patrimonio − utilidad neta)",
        terms: [
          ["grp", "equity", 1],
          ["acc", "capital", -1],
          ["inc", "net", -1],
        ],
      },
    ],
    indirect: [
      { key: "net", label: "Utilidad neta", terms: [["inc", "net", 1]] },
      {
        key: "dep",
        label: "+ Depreciación",
        terms: [["inc", "depreciation", 1]],
      },
      {
        key: "ar",
        label: "− Variación de CxC",
        terms: [["acc", "receivables", -1]],
      },
      {
        key: "inv",
        label: "− Variación de inventario",
        terms: [["acc", "inventory", -1]],
      },
      {
        key: "oca",
        label: "− Variación de otros activos corrientes",
        terms: [["acc", "otherCurrent", -1]],
      },
      {
        key: "ap",
        label: "+ Variación de proveedores",
        terms: [["acc", "payables", 1]],
      },
      {
        key: "tax",
        label: "+ Variación de impuestos por pagar",
        terms: [["acc", "taxPayable", 1]],
      },
      {
        key: "ocl",
        label: "+ Variación de otros pasivos corrientes",
        terms: [["acc", "otherDebt", 1]],
      },
      ...wcLine,
    ],
  };
}

export function linkedFlowLines(period, previous, accounts) {
  const s = statements(period, accounts),
    p = statements(previous, accounts);
  const defaults = new Set(defaultAccounts.map((a) => a.id));
  const d = (id) => num(period.balance[id]) - num(previous.balance[id]);
  const term = ([type, ref, sign]) =>
    sign *
    (type === "inc"
      ? s[ref]
      : type === "acc"
        ? d(ref)
        : type === "grp"
          ? s[ref] - p[ref]
          : sum(
              accounts
                .filter((a) => a.group === ref && !defaults.has(a.id))
                .map((a) => d(a.id)),
            ));
  const spec = linkedFlowSpec(accounts);
  return Object.fromEntries(
    Object.entries(spec).map(([group, lines]) => [
      group,
      lines.map((l) => ({ ...l, value: sum(l.terms.map(term)) })),
    ]),
  );
}

export function plan(budget, period, accounts) {
  const s = statements(period, accounts),
    linked = budget.linked,
    span = Math.max(1, num(period.months)),
    price = num(budget.price),
    cost = num(budget.cost);
  const initialUnits = linked
    ? divide(num(period.balance.inventory), cost)
    : num(budget.initialUnits);
  const initialCash = linked
    ? num(period.balance.cash)
    : num(budget.initialCash);
  const receivables = linked
      ? num(period.balance.receivables)
      : num(budget.receivables),
    payables = linked ? num(period.balance.payables) : num(budget.payables);
  const taxRate = linked ? s.taxRate : num(budget.taxRate),
    cashPct = num(budget.cashPct) / 100,
    payPct = num(budget.payPct) / 100;
  let openingUnits = initialUnits ?? 0,
    openingCash = initialCash,
    priorCreditSales = receivables,
    priorCreditPurchases = payables;
  let priorUnits = divide(s.sales / span, price) ?? 0;
  const rows = budget.months.map((m) => {
    const units = linked
      ? priorUnits * (1 + num(m.growth) / 100)
      : num(m.units);
    const desired = num(m.desired),
      need = units + desired - openingUnits;
    // Excess opening stock is retained, rather than generating negative purchases.
    const purchaseUnits = Math.max(0, need),
      closingUnits = openingUnits + purchaseUnits - units;
    const purchases = purchaseUnits * cost,
      sales = units * price,
      cogs = (openingUnits + purchaseUnits - closingUnits) * cost;
    const expense = linked ? s.opex / span : num(m.expense),
      depreciation = linked ? s.depreciation / span : num(m.depreciation),
      interest = linked ? s.interest / span : num(m.interest);
    const gross = sales - cogs,
      ebit = gross - expense - depreciation,
      ebt = ebit - interest,
      tax = (Math.max(0, ebt) * taxRate) / 100,
      net = ebt - tax;
    const currentCollections = sales * cashPct,
      previousCollections = priorCreditSales,
      collections = currentCollections + previousCollections;
    const currentPayments = purchases * payPct,
      previousPayments = priorCreditPurchases,
      payments = currentPayments + previousPayments;
    const otherOut = expense + interest + tax + num(m.otherOut),
      closingCash =
        openingCash + collections + num(m.otherIn) - payments - otherOut;
    const row = {
      ...m,
      units,
      openingUnits,
      closingUnits,
      purchaseUnits,
      purchases,
      sales,
      cogs,
      expense,
      depreciation,
      interest,
      gross,
      ebit,
      ebt,
      tax,
      net,
      currentCollections,
      previousCollections,
      collections,
      currentPayments,
      previousPayments,
      payments,
      otherOut,
      openingCash,
      closingCash,
      receivables: sales * (1 - cashPct),
      payables: purchases * (1 - payPct),
      need: Math.max(0, num(budget.minimum) - closingCash),
    };
    openingUnits = closingUnits;
    openingCash = closingCash;
    priorCreditSales = row.receivables;
    priorCreditPurchases = row.payables;
    priorUnits = units;
    return row;
  });
  return {
    rows,
    initialUnits,
    initialCash,
    receivables,
    payables,
    taxRate,
    valid: price > 0 && cost > 0,
    totals: Object.fromEntries(
      [
        "sales",
        "purchases",
        "cogs",
        "expense",
        "depreciation",
        "interest",
        "gross",
        "ebit",
        "ebt",
        "tax",
        "net",
        "collections",
        "payments",
        "otherOut",
      ].map((k) => [k, sum(rows.map((r) => r[k]))]),
    ),
  };
}
export function personalTotals(entries) {
  const income = sum(
      entries.filter((e) => e.kind === "income").map((e) => e.amount),
    ),
    expenses = sum(
      entries.filter((e) => e.kind !== "income").map((e) => e.amount),
    );
  return {
    income,
    expenses,
    balance: income - expenses,
    savings: divide(income - expenses, income),
  };
}
export function stock(item) {
  const quantity = num(item.initial) + num(item.incoming) - num(item.outgoing);
  return {
    quantity,
    value: quantity * num(item.cost),
    low: quantity < num(item.minimum),
    invalid: quantity < 0,
  };
}
