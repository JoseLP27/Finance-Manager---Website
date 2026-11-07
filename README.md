# Finance Manager

Aplicación académica de análisis y planeación financiera para Gestión Financiera Operativa (IS2122), UNI Nicaragua. React, Tailwind CSS, Vite y Recharts. Paleta azul, blanco y gris; navegación lateral adaptable a móviles.

**El sitio comienza desde cero, sin empresas ni cifras precargadas.** Los materiales de `../Archivos claves` se utilizan como referencia de fórmulas y como comprobaciones automatizadas, según la aclaración del usuario.

**Sitio publicado:** https://joselp27.github.io/Finance-Manager---Website/

## Ejecutar

Requiere Node.js 22.12 o superior.

```sh
npm ci
npm run dev
```

Abrir la dirección indicada por Vite. Para comprobar la distribución final:

```sh
npm test
npm run build
npm run preview
```

## Módulos

1. **Panel:** liquidez, ROE/ROA, caja proyectada, punto de equilibrio, evolución y accesos.
2. **Estados:** balances y resultados por período, cuentas adicionales, comprobación de ecuación contable, análisis vertical/horizontal y exportaciones CSV.
3. **Razones y DuPont:** liquidez, actividad con promedios, endeudamiento y rentabilidad. Descomposición verificable del ROE.
4. **C-V-U:** modelo vinculado o manual, escenarios de volumen/precio/costos, gráfico interactivo, UPA y GAO/GAF/GAT por ambos métodos.
5. **EFE:** movimientos de operación/inversión/financiamiento por período, método directo e indirecto y conciliación con el balance.
6. **Presupuesto maestro:** ventas, compras, inventario, costo de ventas, gastos, resultados y calendario de caja. Modo vinculado a estados o manual.
7. **Personal:** ingresos, gastos fijos/variables, ahorro y gráfico circular; independiente de la empresa.
8. **Inventario:** existencias, valoración y alerta de reposición; aplicación complementaria.
9. **Interpretación de IA:** al final de cada módulo, un botón envía solo los resultados ya calculados a Gemini y muestra una lectura en Markdown. No decide ni recomienda operaciones.

## Asistente de IA (Gemini)

Cada módulo incluye una tarjeta **Interpretación de IA**. El botón se desactiva si el módulo no tiene datos y muestra el motivo. Al abrirlo, la app envía únicamente el resumen de cifras calculadas (no el respaldo completo ni datos personales) y presenta la respuesta en Markdown.

La app admite dos modos:

1. **Proxy propio (recomendado para el sitio publicado).** La clave de Gemini vive como secreto del servidor y nunca llega al navegador. El Worker incluido en `ai-proxy/` recibe la solicitud, valida el origen y el tamaño, agrega la clave y llama a Gemini. Instrucciones en [`ai-proxy/README.md`](ai-proxy/README.md). En GitHub solo se configura la variable `AI_PROXY_URL` (y opcionalmente `AI_PROXY_TOKEN`); **nunca** `VITE_GEMINI_API_KEY`.
2. **Modo directo (solo desarrollo local o uso personal).** La clave se ingresa en **Configuración → Asistente de IA** y se guarda en `sessionStorage`: desaparece al cerrar la pestaña y no se incluye en los respaldos JSON. También se puede definir en `.env.local` (copia `.env.example`):

```sh
VITE_GEMINI_API_KEY=tu_clave
VITE_GEMINI_MODEL=gemini-3.8-flash
```

**Advertencia de seguridad:** cualquier variable `VITE_` se inserta en el JavaScript publicado y puede leerse desde el navegador. No publiques `VITE_GEMINI_API_KEY` en GitHub Pages: usa el proxy. Si una clave se comparte por chat o se publica, rótala y limita su cuota en Google AI Studio.

El modelo predeterminado es `gemini-3.8-flash`, el reemplazo de `gemini-3.6-flash` (retirado en Vertex AI el **19 de noviembre de 2026**). Puedes cambiarlo sin tocar el código con `VITE_GEMINI_MODEL` o con la variable `AI_MODEL` del repositorio. El prompt del sistema limita la respuesta a interpretación: no emite decisiones, órdenes ni asesoría legal, tributaria o de inversión.

## Flujo de uso

Configurar empresa y moneda con el botón superior. Ingresar períodos en orden cronológico, con su duración de 1 a 12 meses. Registrar saldos e ingresos/gastos en Estados financieros. Revisar que el balance cuadre. Las razones, DuPont y los modos vinculados de C-V-U y presupuesto consumen estos datos automáticamente. El período del encabezado controla qué estado se analiza.

Los datos se conservan en `localStorage` del navegador, sin servidor ni cuentas de usuario. **Respaldar datos** descarga JSON; **Configurar → Importar respaldo** restaura un archivo validado, previa confirmación de reemplazo. Los CSV se abren en Excel y se pueden editar allí. Cambiar de navegador, dispositivo o dominio requiere importar el respaldo. El presupuesto personal comparte la moneda seleccionada, pero sus importes no intervienen en las finanzas empresariales.

## Supuestos y límites explícitos

- Campos vacíos equivalen a cero; denominadores cero producen `N/D`. No se redondean resultados intermedios.
- Las monedas son etiquetas de los importes capturados; no hay conversión cambiaria.
- Liquidez usa saldos al cierre. Actividad, ROA/ROE y DuPont utilizan promedio de los dos balances consecutivos disponibles, o cierre si hay uno. Días = 365 × meses / 12. Los beneficios y rotaciones no se anualizan.
- Inventarios, clientes y proveedores deben capturarse en las cuentas principales para las razones. Las cuentas adicionales participan en el balance y análisis estructural; sus ajustes al EFE se incorporan explícitamente en otros ajustes.
- La utilidad del ejercicio debe estar incluida en patrimonio por el usuario. No se añade de nuevo automáticamente.
- Impuesto configurable como supuesto académico, aplicado solo a utilidad positiva; sin crédito fiscal automático por pérdidas.
- C-V-U supone un producto o mezcla constante. En modo vinculado se trata costo de ventas como variable y gastos operativos/depreciación como fijos. Otros ingresos del estado no se incluyen en C-V-U porque no pertenecen al modelo operativo.
- Presupuesto de un producto con costo unitario constante. Crédito cobrado/pagado íntegro al siguiente mes; saldos anteriores en el primer mes. Impuestos e intereses pagados en el mes; depreciación sin desembolso. La reserva mínima no genera un préstamo automático. El exceso de inventario inicial no genera compras negativas.
- EFE clasifica intereses e impuestos como operación. Otros ajustes deben conciliar partidas no monetarias, ganancias por enajenación y cuentas adicionales. Cada movimiento pertenece a un período.
- Inventario complementario: costo constante, sin FIFO, promedio móvil, facturación ni integración contable automática.

## Arquitectura

```text
src/lib/finance.js        Cálculos financieros puros
src/lib/store.jsx         Estado compartido y guardado local
src/lib/validation.js     Validación de respaldos
src/lib/format.js         Moneda, porcentajes, CSV y descargas
src/services/aiService.js Cliente de Gemini, prompt y manejo de la clave
src/services/aiContexts.js Resúmenes por módulo enviados al modelo
src/components/          Controles, gráficas e InterpretacionIA reutilizables
src/modules/             Una pantalla por módulo
src/App.jsx              Navegación por hash, configuración y ayuda
ai-proxy/                Worker de Cloudflare que guarda la clave de Gemini
tests/                   Comprobaciones con materiales de clase y casos límite
.env.example             Plantilla de variables de entorno (sin clave real)
docs/FUENTES.md           Trazabilidad académica
```

## GitHub Pages

El workflow `.github/workflows/deploy.yml` ejecuta pruebas y compilación al subir a `main`, y publica `dist` con GitHub Actions. La ruta base relativa y la navegación por hash permiten cargar cualquier módulo bajo el subdirectorio del repositorio. En GitHub, **Settings → Pages → Source** debe utilizar **GitHub Actions**. Si no está habilitado, el propietario debe habilitarlo; el workflow intentará la configuración con los permisos disponibles.

## Verificación

`npm test` verifica TOR, Bartlett, DuPont, Electrónicas, El Progreso, San Rafael, EFE, independencia de datos personales, integración de cambios, divisiones por cero, pérdidas, exceso de inventario, respaldos inválidos y los resúmenes que se envían al asistente de IA. Las cifras de prueba no se importan en la aplicación y no se incluyen en su paquete de producción.

Sitio académico independiente. El logotipo UNI fue proporcionado por el usuario y se incorpora sin alterar sus proporciones ni colores; su presencia identifica el contexto universitario y no implica que el sitio sea oficial.
