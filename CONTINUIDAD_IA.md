# Continuidad del proyecto Finance Manager

## Instrucción del usuario

Construir en esta carpeta una SPA React + Tailwind, móvil, azul/blanco/gris inspirada en UNI Managua. Implementar dashboard, estados y análisis vertical/horizontal, razones y DuPont, C-V-U y apalancamiento, EFE directo/indirecto, presupuesto maestro y caja, presupuesto personal e inventario. Subir a https://github.com/JoseLP27/Finance-Manager---Website.git. Autorizada la subida por el usuario.

## Aclaraciones posteriores que prevalecen

- El usuario corrigió el pedido original: **no quiere datos predeterminados; la aplicación debe trabajar desde cero**. No agregar botones seed ni empresas precargadas. Los casos solo son fixtures de pruebas, no datos de producción.
- Pidió usar el logotipo UNI adjunto. Se copió sin modificar a `public/uni-logo.png` y se usa en el pie de la barra lateral y en la guía. Preservar proporción y color.

## Fuente de verdad obligatoria

Consultar los originales en `../Archivos claves`. NO inventar cifras atribuyéndolas a los materiales. Leer la guía PDF y los PPTX, el DOCX TOR resuelto y el XLSX Electrónicas antes de modificar fórmulas o ejemplos. `extract_sources.py` produce textos locales en docs/reference-extracts (no versionados). No publicar originales académicos sin necesidad. `docs/FUENTES.md` documenta las cifras y supuestos usados.

## Estado actual (2026-11-06, Managua)

- Carpeta y repositorio remoto estaban vacíos.
- Revisadas la guía PDF (5 páginas), cifras TOR, Progreso, San Rafael, Bartlett, EFE y el balance de Electrónicas.
- Implementados los ocho espacios: dashboard y siete módulos requeridos, con fórmulas compartidas y captura vacía.
- React 19, Vite 7, Tailwind 4, Recharts y Lucide. Código modular formateado con Prettier.
- Estado en Context y localStorage; respaldo/importación JSON con validación estructural, exportaciones CSV protegidas contra fórmulas en nombres.
- Navegación hash para GitHub Pages. Workflow en `.github/workflows/deploy.yml`, build `dist`, base relativa.
- EFE guarda movimientos y ajustes por ID de período. Cambiar período no mezcla movimientos.
- Presupuesto y C-V-U permiten modo vinculado a estados o manual. Personal e inventario son complementarios e independientes.
- README y FUENTES documentan fórmulas, estructura y limitaciones del modelo.
- Pasaron 14 pruebas automatizadas, incluidos ejercicios originales y validación de respaldos. Compilación de producción comprobada; ejecutar de nuevo si hay cambios.
- Verificación real en navegador: captura de balance/resultados, DuPont 20%/ROA 12%, persistencia tras recargar, gráfica C-V-U, presupuesto de caja, gasto personal y alerta de reposición. Pantalla móvil de 390 px sin desbordamiento horizontal en inventario; escritorio de 1440 px revisado.
- Se retiraron los importes temporales usados para pruebas de interfaz; el código de producción nunca contiene fixtures.
- Código subido a `main`, commit inicial `b634a91`. Las pruebas y compilación pasaron también en GitHub Actions.
- El primer workflow falló solo en configurar Pages porque no estaba habilitado. El usuario autorizó explícitamente habilitar Pages y reiniciar la publicación usando su autenticación local de GitHub. Se habilitó correctamente y se reinició el workflow `42334723873`.
- **Publicación completada y verificada:** `https://joselp27.github.io/Finance-Manager---Website/`. Workflow `42334723873`, intento 2, terminó `success`. Se abrió la URL pública en navegador y se verificó el panel vacío, los accesos a módulos y el logotipo UNI.
- No quedan tareas obligatorias de implementación/publicación pendientes. El último commit documental no cambia el sitio compilado; puede usar `[skip ci]` para no repetir un despliegue idéntico.
- Ver detalle y límites de la verificación en `docs/VERIFICACION.md`.

## Cómo continuar

1. Leer este archivo, README y docs/FUENTES.md; luego revisar los originales en `../Archivos claves` para cualquier cambio financiero.
2. `npm ci`, `npm test`, `npm run build`. `npm run dev` para desarrollo, `npm run preview` para distribución compilada.
3. Cálculos en `src/lib/finance.js`; vistas en `src/modules`; guardado en `src/lib/store.jsx`; importación segura en `src/lib/validation.js`.
4. Mantener captura desde cero y el logotipo adjunto. No transformar esto en una colección de calculadoras aisladas.
5. No subir originales, extractos, datos personales del navegador, node_modules ni credenciales. El `.gitignore` excluye extractos y dist.
6. Repetir las pruebas afectadas después de editar y actualizar este documento con lo realizado y lo pendiente.

## Alcance deliberado

Plan de un producto con costo constante, cobro/pago del crédito al siguiente mes; impuesto sobre utilidad positiva; sin reglas tributarias legales ni saldos fiscales. Otros ajustes del EFE permiten conciliar cuentas adicionales. No hay base de datos remota, autenticación ni sincronización entre equipos. No hay conversión automática de monedas. Ver supuestos completos en README.

## Entorno

Node y npm disponibles. `gh` no está instalado. Python del sistema no funciona; el runtime de Codex incluye Python, pypdf y openpyxl. Git remoto accesible con ejecución autorizada fuera de las restricciones de red. No imprimir credenciales.

## Criterios financieros importantes

- Promedios para actividad y DuPont con dos balances; liquidez al cierre; 365 días para períodos anuales.
- Base cero produce N/D, nunca Infinity ni un 0% engañoso.
- TOR usa dólares, 100000 unidades, P 7.5, CV 3, CF 250000, intereses 80000, DAP 40000, T 40%, acciones 20000; GAO 2.25, GAF 3.75, GAT 8.4375.
- Progreso: 120/150/180 unidades, P C$600, costo C$350, inventario inicial 30, finales 30/36/40; compras 42000/54600/64400, utilidad neta 7000/11900/16800.
- San Rafael caja: ventas 50000/60000/70000; compras 31200/37200/43200; cobro 60%, pago 50%, caja inicial 5000; caja final 6900/14650/24850.
- EFE clase: operación 20000, inversión -13000, financiamiento 20000, inicial 25000, final 52000; indirecto 22000 + 4000 - 6000.
- No mezclar monedas o empresas. Los datos adicionales deben señalarse como supuestos académicos.
