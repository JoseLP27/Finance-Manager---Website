// Construye un resumen legible de cada módulo para enviarlo al asistente.
// Solo incluye datos ya calculados por finance.js: la IA no recalcula.
import {
  statements,
  ratios,
  cvu,
  cvuInputs,
  cashFlow,
  plan,
  personalTotals,
  stock,
  change,
  divide,
  num,
  accountGroups,
} from "../lib/finance.js";
import { money, percent, times, number } from "../lib/format.js";

const tipoPersonal = {
  income: "Ingreso",
  fixed: "Gasto fijo",
  variable: "Gasto variable",
};

const monedaNombre = (currency) => (currency === "$" ? "Dólares" : "Córdobas");

const redondear = (value, decimals = 2) =>
  value == null || !Number.isFinite(Number(value))
    ? null
    : Number(Number(value).toFixed(decimals));

const grupo = (title, pairs) => ({ grupo: title, indicadores: pairs });

export function hayDatosEnPeriodo(period) {
  if (!period) return false;
  return (
    Object.values(period.balance).some((v) => v !== "" && v != null) ||
    Object.values(period.income).some((v) => v !== "" && v != null)
  );
}

function base(data, period) {
  return {
    empresa: data.company || "Sin nombre registrado",
    moneda: data.currency,
    monedaNombre: monedaNombre(data.currency),
    periodo: period?.label || "Sin período",
    duracionMeses: period?.months ?? null,
  };
}

export function contextoEstados(data, period, previous) {
  const s = statements(period, data.accounts);
  const ps = previous ? statements(previous, data.accounts) : null;
  if (!s) return { ...base(data, period), disponible: false };

  const cuentas = data.accounts
    .map((a) => ({
      cuenta: a.label,
      grupo: accountGroups[a.group],
      saldo:
        a.id === "accDep"
          ? -num(period.balance[a.id])
          : num(period.balance[a.id]),
    }))
    .filter((x) => x.saldo !== 0)
    .map((x) => ({ ...x, saldo: money(x.saldo, data.currency) }));

  const resultados = [
    ["Ventas netas", s.sales],
    ["Costo de ventas", s.cogs],
    ["Utilidad bruta", s.gross],
    ["Gastos operativos desembolsables", s.opex],
    ["Depreciación", s.depreciation],
    ["UAII / utilidad operativa", s.ebit],
    ["Otros ingresos netos", s.otherIncome],
    ["Intereses", s.interest],
    ["Utilidad antes de impuestos", s.ebt],
    ["Impuestos", s.tax],
    ["Utilidad neta", s.net],
  ].map(([concepto, valor]) => ({
    concepto,
    valor: money(valor, data.currency),
  }));

  return {
    ...base(data, period),
    disponible: hayDatosEnPeriodo(period),
    balance: {
      activoCorriente: money(s.current, data.currency),
      activoFijoNeto: money(s.fixed, data.currency),
      otrosActivos: money(s.otherAsset, data.currency),
      totalActivos: money(s.assets, data.currency),
      pasivoCorriente: money(s.currentDebt, data.currency),
      pasivoNoCorriente: money(s.longDebt, data.currency),
      totalPasivos: money(s.liabilities, data.currency),
      patrimonio: money(s.equity, data.currency),
      diferenciaEcuacion: money(s.difference, data.currency),
      ecuacionCuadra: Math.abs(s.difference) <= 0.005,
    },
    cuentas,
    resultados,
    supuestos: {
      tasaImpuesto: percent(s.taxRate / 100),
      ventasACredito: percent(s.creditPct / 100),
      comprasACredito: money(s.creditPurchases, data.currency),
    },
    comparacion: previous
      ? {
          periodoBase: previous.label,
          activos: {
            base: money(ps.assets, data.currency),
            actual: money(s.assets, data.currency),
            variacion: percent(change(s.assets, ps.assets)),
          },
          ventas: {
            base: money(ps.sales, data.currency),
            actual: money(s.sales, data.currency),
            variacion: percent(change(s.sales, ps.sales)),
          },
          utilidadNeta: {
            base: money(ps.net, data.currency),
            actual: money(s.net, data.currency),
            variacion: percent(change(s.net, ps.net)),
          },
        }
      : null,
    nota: "La utilidad del ejercicio debe estar incluida por el usuario en el patrimonio; la app no la suma dos veces.",
  };
}

export function contextoRazones(data, period, previous) {
  const s = statements(period, data.accounts);
  if (!s) return { ...base(data, period), disponible: false };
  const r = ratios(period, previous, data.accounts);
  const ps = previous ? statements(previous, data.accounts) : null;

  return {
    ...base(data, period),
    disponible: hayDatosEnPeriodo(period),
    periodoComparacion: previous?.label || null,
    criterioPromedios: previous
      ? `Actividad, ROA, ROE y DuPont usan promedio entre ${previous.label} y ${period.label}. Liquidez y endeudamiento usan saldos de cierre.`
      : "Solo hay un balance: se usan saldos de cierre como aproximación.",
    baseDias: number(r.days),
    liquidez: grupo("Liquidez", [
      ["Capital de trabajo neto", money(r.ctn, data.currency)],
      ["Razón corriente", times(r.current)],
      ["Prueba ácida", times(r.acid)],
    ]),
    actividad: grupo("Actividad", [
      ["Rotación de inventario", times(r.inventoryRotation)],
      ["Edad promedio de inventario", `${number(r.inventoryDays)} días`],
      ["Rotación de cuentas por cobrar", times(r.arRotation)],
      ["Período promedio de cobro", `${number(r.collectionDays)} días`],
      ["Rotación de cuentas por pagar", times(r.apRotation)],
      ["Período promedio de pago", `${number(r.paymentDays)} días`],
      ["Rotación de activos fijos", times(r.fixedRotation)],
      ["Rotación de activos totales", times(r.turnover)],
    ]),
    endeudamiento: grupo("Endeudamiento", [
      ["Razón de endeudamiento", percent(r.debt)],
      ["Deuda / patrimonio", times(r.debtEquity)],
      ["Cobertura de intereses", times(r.interestCoverage)],
    ]),
    rentabilidad: grupo("Rentabilidad", [
      ["Margen bruto", percent(r.grossMargin)],
      ["Margen operativo", percent(r.operatingMargin)],
      ["Margen neto", percent(r.margin)],
      ["ROA", percent(r.roa)],
      ["ROE", percent(r.roe)],
    ]),
    dupont: {
      margenNeto: percent(r.margin),
      rotacionActivos: times(r.turnover),
      multiplicadorCapital: times(r.multiplier),
      roeDuPont: percent(r.dupont),
      roeDirecto: percent(r.roe),
      coincide:
        r.dupont != null && r.roe != null && Math.abs(r.dupont - r.roe) < 1e-9,
    },
    promedios: {
      activos: money(
        previous ? (s.assets + ps.assets) / 2 : s.assets,
        data.currency,
      ),
      patrimonio: money(
        previous ? (s.equity + ps.equity) / 2 : s.equity,
        data.currency,
      ),
      inventario: money(
        previous
          ? (num(period.balance.inventory) + num(previous.balance.inventory)) /
              2
          : num(period.balance.inventory),
        data.currency,
      ),
      cuentasPorCobrar: money(
        previous
          ? (num(period.balance.receivables) +
              num(previous.balance.receivables)) /
              2
          : num(period.balance.receivables),
        data.currency,
      ),
      cuentasPorPagar: money(
        previous
          ? (num(period.balance.payables) + num(previous.balance.payables)) / 2
          : num(period.balance.payables),
        data.currency,
      ),
    },
    advertenciaPatrimonio:
      s.equity <= 0
        ? "El patrimonio es cero o negativo: ROE y multiplicador pueden no ser interpretables."
        : null,
  };
}

export function contextoCvu(data, period) {
  const s = statements(period, data.accounts);
  if (!s) return { ...base(data, period), disponible: false };

  const config = data.cvu;
  const input = cvuInputs(config, s);
  const resultado = cvu(input);
  const escenarioInput = {
    ...input,
    units:
      config.scenarioUnits === "" ? input.units : num(config.scenarioUnits),
    price:
      input.price == null
        ? null
        : input.price * (1 + num(config.priceChange) / 100),
    variable:
      input.variable == null
        ? null
        : input.variable * (1 + num(config.costChange) / 100),
    fixed: input.fixed * (1 + num(config.fixedChange) / 100),
  };
  const escenario = cvu(escenarioInput);
  const ds =
    resultado.valid && escenario.valid
      ? change(escenario.sales, resultado.sales)
      : null;
  const de =
    resultado.valid && escenario.valid
      ? change(escenario.ebit, resultado.ebit)
      : null;
  const dp =
    resultado.valid &&
    escenario.valid &&
    escenario.eps != null &&
    resultado.eps != null
      ? change(escenario.eps, resultado.eps)
      : null;

  const fila = (etiqueta, clave) => ({
    concepto: etiqueta,
    base: resultado.valid ? money(resultado[clave], data.currency) : "N/D",
    escenario: escenario.valid ? money(escenario[clave], data.currency) : "N/D",
  });

  return {
    ...base(data, period),
    disponible: resultado.valid,
    modo: config.linked ? "Vinculado al estado financiero" : "Manual",
    supuestos: {
      unidades: number(input.units),
      precioUnitario: money(input.price, data.currency),
      costoVariableUnitario: money(input.variable, data.currency),
      costosFijos: money(input.fixed, data.currency),
      intereses: money(input.interest, data.currency),
      tasaImpuesto: percent(num(input.taxRate) / 100),
      dividendosPreferentes: money(input.dividends, data.currency),
      accionesComunes: number(input.shares),
    },
    comparado: [
      fila("Ventas", "sales"),
      fila("Costos variables", "variableTotal"),
      fila("Margen de contribución", "contribution"),
      fila("UAII", "ebit"),
      fila("Utilidad antes de impuestos", "ebt"),
      fila("Impuestos", "tax"),
      fila("Utilidad neta", "net"),
      fila("Utilidad por acción (UPA)", "eps"),
    ],
    equilibrio: {
      unidades: resultado.q == null ? "N/D" : number(resultado.q),
      unidadesMinimasEnteras:
        resultado.q == null ? "N/D" : Math.ceil(resultado.q),
      ventas: money(resultado.breakEvenMoney, data.currency),
      margenContribucionUnitario: money(
        resultado.contributionUnit,
        data.currency,
      ),
      margenSeguridad: percent(resultado.safety),
    },
    escenario: {
      unidades: number(
        config.scenarioUnits === "" ? input.units : config.scenarioUnits,
      ),
      cambioPrecio: percent(num(config.priceChange) / 100),
      cambioCostoVariable: percent(num(config.costChange) / 100),
      cambioCostosFijos: percent(num(config.fixedChange) / 100),
      cambioVentas: percent(ds),
      cambioUaii: percent(de),
      cambioUpa: percent(dp),
    },
    apalancamiento: {
      gaoDirecto: times(resultado.gao),
      gafDirecto: times(resultado.gaf),
      gatDirecto: times(resultado.gat),
      gaoPorVariaciones: times(divide(de, ds)),
      gafPorVariaciones: times(divide(dp, de)),
      gatPorVariaciones: times(divide(dp, ds)),
    },
    advertencia:
      resultado.valid && resultado.contributionUnit <= 0
        ? "El precio no supera el costo variable: no existe punto de equilibrio operativo con margen positivo."
        : null,
    nota: "En modo vinculado, el costo de ventas se trata como variable y los gastos operativos más la depreciación como fijos.",
  };
}

export function contextoEfe(data, period, previous) {
  const s = statements(period, data.accounts);
  if (!s) return { ...base(data, period), disponible: false };

  const f = cashFlow(data.flow, period, previous, data.accounts);
  const settings = data.flow.settings?.[period.id] || {};
  const conciliacion = (
    f.linked
      ? [
          ...f.lines.indirect.map((l) => [l.label, l.value]),
          ["Flujo operativo indirecto", f.indirect],
        ]
      : [
          ["Utilidad neta", s.net],
          ["+ Depreciación", s.depreciation],
          ["− Variación de CxC", -f.delta("receivables")],
          ["− Variación de inventario", -f.delta("inventory")],
          ["− Variación de otros activos corrientes", -f.delta("otherCurrent")],
          ["+ Variación de proveedores", f.delta("payables")],
          ["+ Variación de impuestos por pagar", f.delta("taxPayable")],
          ["+ Variación de otros pasivos corrientes", f.delta("otherDebt")],
          ["± Otros ajustes", num(settings.adjustments)],
          ["Flujo operativo indirecto", f.indirect],
        ]
  ).map(([concepto, valor]) => ({
    concepto,
    valor: money(valor, data.currency),
  }));

  const movimientos = data.flow.entries
    .filter((e) => e.periodId === period.id)
    .map((e) => ({
      concepto: e.label || "(sin concepto)",
      actividad: {
        operating: "Operación",
        investing: "Inversión",
        financing: "Financiamiento",
      }[e.group],
      movimiento: e.direction === "out" ? "Salida" : "Entrada",
      importe: money(e.amount, data.currency),
    }));

  return {
    ...base(data, period),
    disponible: movimientos.length > 0 || Boolean(previous),
    metodo: f.linked
      ? "Directo e indirecto, derivados del balance y el estado de resultados"
      : "Directo e indirecto",
    ...(f.linked && {
      lineasDerivadas: ["operating", "investing", "financing"].flatMap((g) =>
        f.lines[g].map((l) => ({
          actividad: {
            operating: "Operación",
            investing: "Inversión",
            financing: "Financiamiento",
          }[g],
          concepto: l.label,
          importe: money(l.value, data.currency),
        })),
      ),
    }),
    saldoInicial: money(f.initial, data.currency),
    actividades: {
      operacionDirecta: money(f.operating, data.currency),
      operacionIndirecta: money(f.indirect, data.currency),
      inversion: money(f.investing, data.currency),
      financiamiento: money(f.financing, data.currency),
    },
    resultado: {
      variacionNeta: money(f.net, data.currency),
      saldoFinalDirecto: money(f.final, data.currency),
      saldoFinalIndirecto: money(f.indirectFinal, data.currency),
      efectivoEnBalance: money(num(period.balance.cash), data.currency),
      diferenciaDirectoBalance: money(
        f.final - num(period.balance.cash),
        data.currency,
      ),
      diferenciaDirectoIndirecto: money(f.reconciliation, data.currency),
    },
    conciliacion,
    movimientos,
    nota: "Intereses e impuestos se clasifican como operación; préstamos y principal como financiamiento. La depreciación solo ajusta el método indirecto.",
  };
}

export function contextoPresupuesto(data, period) {
  const r = plan(data.budget, period, data.accounts);
  const b = data.budget;

  const meses = r.rows.map((row) => ({
    mes: row.label,
    unidadesVendidas: number(row.units),
    inventarioInicialUnidades: number(row.openingUnits),
    inventarioFinalUnidades: number(row.closingUnits),
    unidadesAComprar: number(row.purchaseUnits),
    compras: money(row.purchases, data.currency),
    ventas: money(row.sales, data.currency),
    costoDeVentas: money(row.cogs, data.currency),
    gastos: money(row.expense, data.currency),
    depreciacion: money(row.depreciation, data.currency),
    intereses: money(row.interest, data.currency),
    uaii: money(row.ebit, data.currency),
    impuestos: money(row.tax, data.currency),
    utilidadNeta: money(row.net, data.currency),
    cobros: money(row.collections, data.currency),
    pagos: money(row.payments, data.currency),
    otrasSalidas: money(row.otherOut, data.currency),
    saldoFinalCaja: money(row.closingCash, data.currency),
    necesidadVsMinimo: money(row.need, data.currency),
  }));

  return {
    ...base(data, period),
    disponible: r.valid && r.rows.length > 0,
    modo: b.linked ? "Vinculado al estado financiero" : "Manual",
    supuestos: {
      precioVenta: money(b.price, data.currency),
      costoUnitario: money(b.cost, data.currency),
      ventasAlContado: percent(num(b.cashPct) / 100),
      ventasACredito: percent(1 - num(b.cashPct) / 100),
      comprasPagadasEnElMes: percent(num(b.payPct) / 100),
      reservaMinima: money(b.minimum, data.currency),
      tasaImpuesto: percent(num(r.taxRate) / 100),
      inventarioInicialUnidades: number(r.initialUnits),
      cajaInicial: money(r.initialCash, data.currency),
      cxcAnteriores: money(r.receivables, data.currency),
      cxpAnteriores: money(r.payables, data.currency),
    },
    meses,
    totales: {
      ventas: money(r.totals.sales, data.currency),
      compras: money(r.totals.purchases, data.currency),
      costoDeVentas: money(r.totals.cogs, data.currency),
      utilidadNeta: money(r.totals.net, data.currency),
      cobros: money(r.totals.collections, data.currency),
      pagos: money(r.totals.payments, data.currency),
      cajaFinalDelPlan: money(r.rows.at(-1)?.closingCash, data.currency),
    },
    alertas: r.rows
      .filter((row) => row.need > 0)
      .map(
        (row) =>
          `${row.label}: ${row.closingCash < 0 ? "déficit de caja" : "saldo inferior a la reserva mínima"}; faltan ${money(row.need, data.currency)}.`,
      ),
    nota: "El crédito se cobra o paga íntegramente al mes siguiente. La depreciación reduce la utilidad pero no la caja. No se agrega financiamiento automático.",
  };
}

export function contextoPersonal(data) {
  const p = personalTotals(data.personal);
  const gastos = data.personal.filter((x) => x.kind !== "income");
  const porCategoria = {};
  gastos.forEach((x) => {
    const key = x.category.trim() || "Sin categoría";
    porCategoria[key] = (porCategoria[key] || 0) + num(x.amount);
  });

  return {
    empresa: "Presupuesto personal (independiente de la empresa)",
    moneda: data.currency,
    monedaNombre: monedaNombre(data.currency),
    periodo: "Presupuesto mensual personal",
    disponible: data.personal.length > 0,
    totales: {
      ingresosMensuales: money(p.income, data.currency),
      gastosMensuales: money(p.expenses, data.currency),
      saldoDisponible: money(p.balance, data.currency),
      capacidadAhorro: percent(p.savings),
    },
    registros: data.personal.map((x) => ({
      categoria: x.category || "(sin categoría)",
      tipo: tipoPersonal[x.kind] || x.kind,
      monto: money(x.amount, data.currency),
    })),
    distribucionGastos: Object.entries(porCategoria).map(
      ([categoria, valor]) => ({
        categoria,
        monto: money(valor, data.currency),
        participacion: percent(divide(valor, p.expenses)),
      }),
    ),
    nota: "Este presupuesto no modifica los estados financieros ni el presupuesto maestro de la empresa.",
  };
}

export function contextoInventario(data) {
  const rows = data.inventory.map((x) => ({ ...x, ...stock(x) }));
  const valorTotal = rows.reduce((total, row) => total + row.value, 0);

  return {
    empresa: data.company || "Sin nombre registrado",
    moneda: data.currency,
    monedaNombre: monedaNombre(data.currency),
    periodo: "Control complementario de inventario",
    disponible: rows.length > 0,
    productosRegistrados: rows.length,
    valorTotal: money(valorTotal, data.currency),
    productosPorReponer: rows.filter((x) => x.low).length,
    productos: rows.map((x) => ({
      producto: x.name || "(sin nombre)",
      existenciaInicial: number(num(x.initial)),
      entradas: number(num(x.incoming)),
      salidas: number(num(x.outgoing)),
      existenciaFinal: number(x.quantity),
      costoUnitario: money(x.cost, data.currency),
      valorInventario: money(x.value, data.currency),
      stockMinimo: number(num(x.minimum)),
      reposicionSugerida: number(Math.max(0, num(x.minimum) - x.quantity)),
      estado: x.invalid
        ? "Inválido: las salidas superan la existencia"
        : x.low
          ? "Por debajo del mínimo"
          : "Stock suficiente",
    })),
    nota: "Valoración a costo unitario constante, sin FIFO ni promedio móvil. No reemplaza el inventario contable del balance.",
  };
}

export function contextoPanel(data, period, previous) {
  const s = statements(period, data.accounts);
  if (!s) return { ...base(data, period), disponible: false };
  const r = ratios(period, previous, data.accounts);
  const b = plan(data.budget, period, data.accounts);
  const c = cvu(cvuInputs(data.cvu, s));

  return {
    ...base(data, period),
    disponible: hayDatosEnPeriodo(period),
    resumen: {
      liquidezCorriente: times(r.current),
      roe: percent(r.roe),
      roa: percent(r.roa),
      cajaProyectada: b.valid
        ? money(b.rows.at(-1)?.closingCash, data.currency)
        : "N/D",
      puntoDeEquilibrio: money(c.breakEvenMoney, data.currency),
      balanceCuadra: Math.abs(s.difference) <= 0.005,
      diferenciaBalance: money(s.difference, data.currency),
    },
    periodosRegistrados: data.periods.map((x) => x.label),
    alertasInventario: data.inventory.filter((x) => stock(x).low).length,
    nota: "El panel resume el período seleccionado y conecta estados, razones, C-V-U y presupuesto.",
  };
}
