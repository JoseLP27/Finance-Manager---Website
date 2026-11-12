// Contenido didáctico de cada módulo. Los ejemplos dinámicos usan las mismas
// funciones puras de lib/finance.js que la interfaz, para que coincidan con lo mostrado.
import FinancialTheoryCard, {
  Frac,
  Eq,
  TheoryGuide,
} from "../components/FinancialTheoryCard";
import { divide, change, num } from "../lib/finance";
import { money, number, percent, times } from "../lib/format";

const ok = (v) => v != null && Number.isFinite(v);
/** Devuelve el texto del ejemplo solo si todos los valores existen. */
const ex = (values, text) => ([].concat(values).every(ok) ? text() : null);
const days = (v) => `${number(v)} días`;

export function StatementsTheory({ s, ps, p, prev, currency }) {
  const mf = (v) => money(v, currency);
  const invShare = divide(num(p.balance.inventory), s.assets);
  const absVar = s.assets - ps.assets;
  const relVar = change(s.assets, ps.assets);
  return (
    <TheoryGuide>
      <FinancialTheoryCard
        title="Ecuación contable y balance general"
        definition="El balance general presenta, a una fecha de cierre, los recursos controlados por la empresa (activos) y sus fuentes de financiamiento: obligaciones con terceros (pasivos) y aportes y resultados de los dueños (patrimonio)."
        formula={<Eq name="Activo">Pasivo + Patrimonio</Eq>}
        interpretation="Si la igualdad se cumple, el registro es consistente: todo recurso tiene una fuente identificada. Una diferencia distinta de cero señala un error de captura u omisión que debe corregirse antes de analizar."
        dynamicExample={ex(s.difference, () =>
          Math.abs(s.difference) <= 0.005
            ? `${mf(s.assets)} = ${mf(s.liabilities)} + ${mf(s.equity)} · cuadrado`
            : `Diferencia de ${mf(s.difference)} · revisar saldos`,
        )}
      />
      <FinancialTheoryCard
        title="Estado de resultados"
        definition="Resume los ingresos, costos y gastos de un período para determinar la utilidad o pérdida. Avanza por niveles: utilidad bruta, operativa (UAII), antes de impuestos y neta."
        formula={
          <Eq name="Utilidad neta">
            Ventas − Costo de ventas − Gastos − Depreciación ± Otros − Intereses
            − Impuestos
          </Eq>
        }
        interpretation="Cada nivel aísla una decisión: la utilidad bruta mide la eficiencia en producir o comprar; la UAII, la gestión operativa; la utilidad neta, lo que queda para los dueños después de financiamiento e impuestos."
        dynamicExample={ex(
          s.net,
          () => `Utilidad neta de ${p.label}: ${mf(s.net)}`,
        )}
      />
      <FinancialTheoryCard
        title="Análisis vertical"
        definition="Técnica de análisis estructural que expresa cada partida como porcentaje de una cifra base del mismo período: el total de activos en el balance o las ventas netas en el estado de resultados."
        formula={
          <Eq name="% Vertical">
            <Frac n="Valor de la cuenta" d="Cifra base" /> × 100
          </Eq>
        }
        interpretation="Define qué proporción del total representa una cuenta, es decir, la composición de la estructura financiera. Permite comparar empresas o períodos de distinto tamaño en términos relativos."
        dynamicExample={ex(
          invShare,
          () =>
            `Inventarios = ${percent(invShare)} del activo total en ${p.label}`,
        )}
      />
      <FinancialTheoryCard
        title="Análisis horizontal · variación absoluta"
        definition="Compara el valor de una misma cuenta entre dos períodos y calcula la diferencia en unidades monetarias."
        formula={
          <Eq name="Variación absoluta">
            Valor<sub>actual</sub> − Valor<sub>base</sub>
          </Eq>
        }
        interpretation="Define cuánto dinero aumentó (positivo) o disminuyó (negativo) una cuenta respecto del período base. Indica la magnitud del cambio, pero no su importancia relativa."
        dynamicExample={ex(
          absVar,
          () => `Activos totales ${prev.label} → ${p.label}: ${mf(absVar)}`,
        )}
      />
      <FinancialTheoryCard
        title="Análisis horizontal · variación relativa"
        definition="Expresa la variación absoluta como porcentaje del valor del período base."
        formula={
          <Eq name="Variación relativa">
            <Frac
              n={
                <>
                  Valor<sub>actual</sub> − Valor<sub>base</sub>
                </>
              }
              d={
                <>
                  Valor<sub>base</sub>
                </>
              }
            />
            × 100
          </Eq>
        }
        interpretation="La variación relativa define en qué porcentaje exacto aumentó o disminuyó una cuenta en comparación con su período base. Si la base es cero, el cálculo no está definido (N/D)."
        dynamicExample={ex(
          relVar,
          () =>
            `Activos totales variaron ${percent(relVar)} frente a ${prev.label}`,
        )}
      />
    </TheoryGuide>
  );
}

export function RatiosTheory({ r, s, currency }) {
  return (
    <TheoryGuide>
      <FinancialTheoryCard
        title="Capital de trabajo neto (CTN)"
        definition="Medida de liquidez en unidades monetarias: el excedente de recursos de corto plazo después de cubrir las obligaciones de corto plazo."
        formula={<Eq name="CTN">Activo corriente − Pasivo corriente</Eq>}
        interpretation="Un CTN positivo indica un colchón para operar sin presión de pagos inmediatos; uno negativo indica que parte del activo de largo plazo se financia con deuda de corto plazo."
        dynamicExample={ex(r.ctn, () => money(r.ctn, currency))}
      />
      <FinancialTheoryCard
        title="Razón corriente"
        definition="Razón de liquidez que compara los activos que se convertirán en efectivo dentro del ciclo operativo con las deudas que vencen en ese mismo plazo."
        formula={
          <Eq name="Razón corriente">
            <Frac n="Activo corriente" d="Pasivo corriente" />
          </Eq>
        }
        interpretation="Define cuántas unidades monetarias de activo corriente respaldan cada unidad de pasivo corriente. Un valor mayor que 1 indica capacidad de cubrir las deudas de corto plazo."
        dynamicExample={ex(r.current, () => `${times(r.current)} de cobertura`)}
      />
      <FinancialTheoryCard
        title="Prueba ácida"
        definition="Versión estricta de la razón corriente que excluye los inventarios, el activo corriente menos líquido."
        formula={
          <Eq name="Prueba ácida">
            <Frac n="Activo corriente − Inventarios" d="Pasivo corriente" />
          </Eq>
        }
        interpretation="Define la capacidad de pago inmediato sin depender de vender inventario. Una brecha grande frente a la razón corriente revela dependencia de las existencias."
        dynamicExample={ex(r.acid, () => times(r.acid))}
      />
      <FinancialTheoryCard
        title="Rotación y edad del inventario"
        definition="Razón de actividad que mide cuántas veces se vende y reemplaza el inventario promedio durante el período."
        formula={
          <span className="flex flex-col gap-3">
            <Eq name="Rotación">
              <Frac n="Costo de ventas" d="Inventario promedio" />
            </Eq>
            <Eq name="Edad promedio">
              <Frac n="Días del período" d="Rotación" />
            </Eq>
          </span>
        }
        interpretation="Una rotación alta implica que el inventario permanece pocos días en bodega; la edad promedio define cuántos días, en promedio, tarda en venderse."
        dynamicExample={ex(
          [r.inventoryRotation, r.inventoryDays],
          () => `${times(r.inventoryRotation)} · ${days(r.inventoryDays)}`,
        )}
      />
      <FinancialTheoryCard
        title="Período promedio de cobro y de pago"
        definition="Razones de actividad que convierten la rotación de cuentas por cobrar y por pagar en días."
        formula={
          <span className="flex flex-col gap-3">
            <Eq name="PPC">
              <Frac
                n="Días"
                d={<Frac n="Ventas a crédito" d="CxC promedio" />}
              />
            </Eq>
            <Eq name="PPP">
              <Frac
                n="Días"
                d={<Frac n="Compras a crédito" d="CxP promedio" />}
              />
            </Eq>
          </span>
        }
        interpretation="El PPC define cuántos días tarda la empresa en cobrar; el PPP, cuántos días tarda en pagar. Cobrar antes de pagar (PPC < PPP) alivia la caja."
        dynamicExample={ex(
          [r.collectionDays, r.paymentDays],
          () => `PPC ${days(r.collectionDays)} · PPP ${days(r.paymentDays)}`,
        )}
      />
      <FinancialTheoryCard
        title="Razón de endeudamiento"
        definition="Razón de apalancamiento que mide la proporción de los activos financiada por terceros."
        formula={
          <Eq name="Endeudamiento">
            <Frac n="Pasivo total" d="Activo total" />
          </Eq>
        }
        interpretation="Define qué porcentaje de los recursos pertenece a los acreedores. A mayor valor, mayor riesgo financiero y menor margen para nueva deuda."
        dynamicExample={ex(
          r.debt,
          () => `${percent(r.debt)} financiado con deuda`,
        )}
      />
      <FinancialTheoryCard
        title="Cobertura de intereses"
        definition="Mide cuántas veces la utilidad operativa cubre el gasto por intereses."
        formula={
          <Eq name="Cobertura">
            <Frac n="UAII" d="Intereses" />
          </Eq>
        }
        interpretation="Define la holgura para pagar el costo de la deuda con la operación. Un valor cercano a 1 indica que casi toda la utilidad operativa se destina a intereses."
        dynamicExample={ex(r.interestCoverage, () => times(r.interestCoverage))}
      />
      <FinancialTheoryCard
        title="Sistema DuPont (ROE)"
        definition="Descompone la rentabilidad sobre el patrimonio en tres factores: eficiencia en márgenes, eficiencia en el uso de activos y grado de apalancamiento."
        formula={
          <Eq name="ROE">
            <Frac n="Utilidad neta" d="Ventas" /> ×
            <Frac n="Ventas" d="Activo promedio" /> ×
            <Frac n="Activo promedio" d="Patrimonio promedio" />
          </Eq>
        }
        interpretation="Define qué rendimiento obtienen los dueños por cada unidad invertida y qué factor lo impulsa: el margen (cuánto se gana), la rotación (cuánto se vende) o el multiplicador (cuánta deuda se usa)."
        dynamicExample={ex(
          [r.margin, r.turnover, r.multiplier, r.dupont],
          () =>
            `${percent(r.margin)} × ${number(r.turnover)} × ${number(r.multiplier)} = ${percent(r.dupont)}`,
        )}
      />
      <FinancialTheoryCard
        title="Margen neto"
        definition="Razón de rentabilidad que relaciona la utilidad neta con las ventas."
        formula={
          <Eq name="Margen neto">
            <Frac n="Utilidad neta" d="Ventas" />
          </Eq>
        }
        interpretation="Define cuántos centavos de utilidad neta quedan por cada unidad monetaria vendida, después de todos los costos, gastos, intereses e impuestos."
        dynamicExample={ex(
          r.margin,
          () =>
            `${percent(r.margin)} · ${money(s.net, currency)} sobre ${money(s.sales, currency)}`,
        )}
      />
    </TheoryGuide>
  );
}

export function CvuTheory({ input, r, currency }) {
  const mf = (v) => money(v, currency);
  return (
    <TheoryGuide>
      <FinancialTheoryCard
        title="Margen de contribución"
        definition="Es la parte del precio que queda después de cubrir el costo variable unitario y que contribuye a cubrir los costos fijos y generar utilidad."
        formula={<Eq name="MC unitario">Precio − Costo variable unitario</Eq>}
        interpretation="Define cuánto aporta cada unidad vendida. Si es cero o negativo, vender más no cubre los costos fijos."
        dynamicExample={
          r.valid
            ? ex(
                r.contributionUnit,
                () => `${mf(r.contributionUnit)} por unidad`,
              )
            : null
        }
      />
      <FinancialTheoryCard
        title="Punto de equilibrio"
        definition="Nivel de ventas en que los ingresos totales igualan a los costos totales; la UAII es exactamente cero."
        formula={
          <span className="flex flex-col gap-3">
            <Eq name="Q">
              <Frac n="Costos fijos" d="Precio − CV unitario" />
            </Eq>
            <Eq name="Ventas de equilibrio">
              <Frac n="Costos fijos" d="1 − CV / Precio" />
            </Eq>
          </span>
        }
        interpretation="Define el volumen mínimo a vender para no perder. Por debajo de Q hay pérdida operativa; por encima, cada unidad adicional genera utilidad igual a su margen de contribución."
        dynamicExample={
          r.valid
            ? ex(
                [r.q, r.breakEvenMoney],
                () => `${number(r.q)} unidades · ${mf(r.breakEvenMoney)}`,
              )
            : null
        }
      />
      <FinancialTheoryCard
        title="Margen de seguridad"
        definition="Distancia entre las ventas actuales y el punto de equilibrio, expresada como porcentaje de las ventas."
        formula={
          <Eq name="MS">
            <Frac n="Unidades vendidas − Q" d="Unidades vendidas" />
          </Eq>
        }
        interpretation="Define cuánto pueden caer las ventas antes de entrar en pérdida operativa. Un margen alto indica una operación más resistente a caídas de demanda."
        dynamicExample={
          r.valid && r.q != null ? ex(r.safety, () => percent(r.safety)) : null
        }
      />
      <FinancialTheoryCard
        title="Grado de apalancamiento operativo (GAO)"
        definition="Mide la sensibilidad de la UAII ante cambios en las ventas, causada por la existencia de costos fijos operativos."
        formula={
          <span className="flex flex-col gap-3">
            <Eq name="GAO">
              <Frac n="Margen de contribución" d="UAII" />
            </Eq>
            <Eq name="GAO">
              <Frac n="% Δ UAII" d="% Δ Ventas" />
            </Eq>
          </span>
        }
        interpretation="Define cuántas veces se amplifica en la UAII un cambio porcentual en ventas. Un GAO de 3 significa que un aumento de 10% en ventas eleva la UAII 30%."
        dynamicExample={r.valid ? ex(r.gao, () => times(r.gao)) : null}
      />
      <FinancialTheoryCard
        title="Grado de apalancamiento financiero (GAF)"
        definition="Mide la sensibilidad de la utilidad por acción ante cambios en la UAII, causada por cargos financieros fijos (intereses y dividendos preferentes)."
        formula={
          <Eq name="GAF">
            <Frac
              n="UAII"
              d={
                <>
                  UAII − I − <Frac n="DP" d="1 − T" />
                </>
              }
            />
          </Eq>
        }
        interpretation="Define cuántas veces se amplifica en la UPA un cambio porcentual en la UAII. Más deuda eleva el GAF y el riesgo financiero."
        dynamicExample={r.valid ? ex(r.gaf, () => times(r.gaf)) : null}
      />
      <FinancialTheoryCard
        title="Grado de apalancamiento total (GAT)"
        definition="Combina el efecto operativo y el financiero: relaciona cambios en ventas con cambios en la UPA."
        formula={<Eq name="GAT">GAO × GAF</Eq>}
        interpretation="Define el riesgo total de la empresa: en cuánto varía porcentualmente la UPA por cada 1% de variación en las ventas."
        dynamicExample={
          r.valid
            ? ex(
                [r.gao, r.gaf, r.gat],
                () => `${number(r.gao)} × ${number(r.gaf)} = ${times(r.gat)}`,
              )
            : null
        }
      />
    </TheoryGuide>
  );
}

export function CashFlowTheory({ f, s, currency }) {
  const mf = (v) => money(v, currency);
  return (
    <TheoryGuide>
      <FinancialTheoryCard
        title="Estado de flujo de efectivo"
        definition="Estado financiero que explica la variación del efectivo en el período, clasificando las entradas y salidas en actividades de operación, inversión y financiamiento."
        formula={
          <Eq name="Saldo final">
            Saldo inicial + FE<sub>operación</sub> + FE<sub>inversión</sub> + FE
            <sub>financiamiento</sub>
          </Eq>
        }
        interpretation="Define de dónde provino y en qué se utilizó el efectivo. Una empresa sana suele generar efectivo en operación y usarlo en inversión o en pagar financiamiento."
        dynamicExample={ex(
          f.final,
          () => `${mf(f.initial)} + ${mf(f.net)} = ${mf(f.final)}`,
        )}
      />
      <FinancialTheoryCard
        title="Método directo"
        definition="Presenta las principales categorías de cobros y pagos brutos efectivamente realizados en la operación: cobros a clientes, pagos a proveedores, empleados, intereses e impuestos."
        formula={
          <Eq name="FE operación">Σ Cobros operativos − Σ Pagos operativos</Eq>
        }
        interpretation="Define cuánto efectivo generó realmente el giro del negocio, mostrando el origen de cada movimiento."
        dynamicExample={ex(f.operating, () => mf(f.operating))}
      />
      <FinancialTheoryCard
        title="Método indirecto"
        definition="Parte de la utilidad neta y la ajusta por partidas que no movieron efectivo (depreciación) y por las variaciones del capital de trabajo entre dos balances."
        formula={
          <Eq name="FE operación">
            UN + Depreciación − Δ CxC − Δ Inventario + Δ Proveedores ± Otros
          </Eq>
        }
        interpretation="Define por qué la utilidad contable difiere del efectivo generado. Un aumento de clientes o inventario consume caja; un aumento de proveedores la libera."
        dynamicExample={ex(
          [f.indirect, s.net],
          () => `Utilidad ${mf(s.net)} → efectivo operativo ${mf(f.indirect)}`,
        )}
      />
      <FinancialTheoryCard
        title="Conciliación entre métodos"
        definition="Verificación de que ambos métodos producen el mismo flujo de operación, porque describen los mismos hechos desde dos perspectivas."
        formula={
          <Eq name="Diferencia">
            FE<sub>directo</sub> − FE<sub>indirecto</sub> = 0
          </Eq>
        }
        interpretation="Una diferencia distinta de cero define un movimiento no registrado, mal clasificado o una variación de balance no explicada."
        dynamicExample={ex(f.reconciliation, () =>
          Math.abs(f.reconciliation) <= 0.005
            ? "Métodos conciliados (diferencia 0.00)"
            : `Diferencia de ${mf(f.reconciliation)}`,
        )}
      />
    </TheoryGuide>
  );
}

export function BudgetTheory({ r, b, currency }) {
  const mf = (v) => money(v, currency);
  const first = r.rows[0];
  const last = r.rows.at(-1);
  const short = r.rows.filter((x) => x.need > 0).length;
  return (
    <TheoryGuide>
      <FinancialTheoryCard
        title="Presupuesto de ventas"
        definition="Punto de partida del presupuesto maestro: proyecta las unidades a vender y su valor monetario en cada mes del horizonte."
        formula={<Eq name="Ventas">Unidades proyectadas × Precio unitario</Eq>}
        interpretation="Define el nivel de actividad esperado. Todos los demás presupuestos (compras, gastos y caja) dependen de esta cifra."
        dynamicExample={
          first && r.valid
            ? `${first.label}: ${number(first.units)} u × ${mf(num(b.price))} = ${mf(first.sales)}`
            : null
        }
      />
      <FinancialTheoryCard
        title="Presupuesto de compras"
        definition="Determina cuántas unidades deben adquirirse para atender las ventas y mantener el inventario final deseado."
        formula={
          <Eq name="Compras (u)">
            Ventas + Inventario final deseado − Inventario inicial
          </Eq>
        }
        interpretation="Define la necesidad de abastecimiento de cada mes. Si el inventario inicial supera la necesidad, no se compra (no existen compras negativas)."
        dynamicExample={
          first && r.valid
            ? `${first.label}: ${number(first.purchaseUnits)} u · ${mf(first.purchases)}`
            : null
        }
      />
      <FinancialTheoryCard
        title="Costo de ventas presupuestado"
        definition="Costo del inventario que sale con las ventas, calculado a partir del movimiento del inventario valorado."
        formula={<Eq name="CV">Inv. inicial + Compras − Inv. final</Eq>}
        interpretation="Define el costo que se enfrenta a las ventas en el estado de resultados presupuestado, para obtener la utilidad bruta proyectada."
        dynamicExample={
          r.valid
            ? ex(r.totals.cogs, () => `Total del plan: ${mf(r.totals.cogs)}`)
            : null
        }
      />
      <FinancialTheoryCard
        title="Presupuesto de caja"
        definition="Calendario mensual de entradas y salidas de efectivo que traduce las ventas y compras a crédito en cobros y pagos según sus políticas."
        formula={
          <Eq name="Saldo final">
            Saldo inicial + Cobros + Otras entradas − Pagos − Otras salidas
          </Eq>
        }
        interpretation="Define si la empresa tendrá efectivo suficiente cada mes. El saldo final de un mes es el saldo inicial del siguiente."
        dynamicExample={
          last
            ? ex(
                last.closingCash,
                () => `Caja al cierre (${last.label}): ${mf(last.closingCash)}`,
              )
            : null
        }
      />
      <FinancialTheoryCard
        title="Necesidad de financiamiento"
        definition="Faltante de efectivo respecto de la reserva mínima que la empresa decide mantener."
        formula={<Eq name="Necesidad">máx(0, Saldo mínimo − Saldo final)</Eq>}
        interpretation="Define cuánto financiamiento de corto plazo debe gestionarse y en qué mes. Si es cero, existe un excedente que puede invertirse temporalmente."
        dynamicExample={
          r.rows.length
            ? short
              ? `${short} mes(es) bajo la reserva mínima`
              : "Sin faltantes respecto al mínimo"
            : null
        }
      />
    </TheoryGuide>
  );
}

export function ProformaTheory({ r, currency }) {
  const mf = (v) => money(v, currency);
  return (
    <TheoryGuide>
      <FinancialTheoryCard
        title="Estados proforma"
        definition="Estados financieros proyectados para un período futuro: estado de resultados y balance general construidos a partir de supuestos de ventas, costos y políticas de la empresa."
        formula={
          <Eq name="Proforma">Estados actuales + Supuestos de proyección</Eq>
        }
        interpretation="Definen cómo se verían los resultados y la posición financiera si se cumplen los supuestos. Sirven para planear el financiamiento antes de que se necesite."
        dynamicExample={ex(
          r.income.net,
          () => `Utilidad neta proyectada: ${mf(r.income.net)}`,
        )}
      />
      <FinancialTheoryCard
        title="Método de porcentaje de ventas"
        definition="Supone que ciertas partidas (costo de ventas, gastos, cuentas por cobrar, inventario y proveedores) mantienen una proporción constante respecto de las ventas o del costo de ventas."
        formula={
          <span className="flex flex-col gap-3">
            <Eq name="Ventas proforma">Ventas × (1 + g)</Eq>
            <Eq name="Partida proforma">
              <Frac n="Partida actual" d="Ventas actuales" /> × Ventas proforma
            </Eq>
          </span>
        }
        interpretation="Define cuánto crecerán los recursos y obligaciones que dependen del nivel de actividad. Las partidas sin relación directa con las ventas se mantienen."
        dynamicExample={ex(
          r.income.sales,
          () => `Ventas proforma: ${mf(r.income.sales)}`,
        )}
      />
      <FinancialTheoryCard
        title="Utilidades retenidas proforma"
        definition="Parte de la utilidad neta proyectada que permanece en la empresa después de pagar dividendos; es la fuente interna de financiamiento."
        formula={
          <Eq name="UR proforma">
            UR actuales + Utilidad neta proforma − Dividendos
          </Eq>
        }
        interpretation="Define cuánto del crecimiento se financia con recursos propios generados por la operación."
        dynamicExample={ex(
          r.retainedAdded,
          () => `Se retienen ${mf(r.retainedAdded)} en el período`,
        )}
      />
      <FinancialTheoryCard
        title="Financiamiento externo requerido (FER)"
        definition="Monto que la empresa debe obtener de fuentes externas (deuda o nuevo capital) para que el balance proforma cuadre."
        formula={
          <Eq name="FER">
            Activo total proforma − (Pasivo + Patrimonio proforma)
          </Eq>
        }
        interpretation="Si es positivo, define el financiamiento adicional que se debe gestionar; si es negativo, indica un excedente de fondos disponible."
        dynamicExample={ex(r.fer, () =>
          r.fer > 0.005
            ? `Se requieren ${mf(r.fer)}`
            : `Excedente de ${mf(-r.fer)}`,
        )}
      />
    </TheoryGuide>
  );
}
