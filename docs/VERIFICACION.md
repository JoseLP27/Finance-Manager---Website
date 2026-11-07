# Verificación de la aplicación

Fecha de trabajo: 6 de noviembre de 2026, Managua.

## Cálculos y compilación

- `npm test`: 14 pruebas aprobadas.
- `npm run build`: compilación de producción correcta, con gráficas separadas en un archivo independiente.
- GitHub Actions también ejecutó `npm ci`, las 14 pruebas y la compilación correctamente.
- GitHub Pages habilitado con autorización explícita del usuario. Workflow `42334723873`, intento 2, finalizó correctamente. Se verificó en navegador la URL pública `https://joselp27.github.io/Finance-Manager---Website/`, con el panel vacío y el logo UNI.
- Fuentes de los resultados esperados: `FUENTES.md`. Las cifras se incluyen únicamente en pruebas, no en la aplicación de producción.

## Navegador

Se comprobó la versión local con la interfaz real:

- Inicio vacío, navegación de los siete módulos y controles de captura.
- Balance con activo 100,000, pasivo 40,000 y capital 60,000; resultados con ventas 200,000 y costo 188,000. La vista DuPont mostró margen 6%, rotación 2, multiplicador 1.67 y ROE 20%; ROA 12%.
- Persistencia de esos resultados al recargar.
- Gráfico C-V-U generado a partir de los estados y unidades capturadas.
- Presupuesto vinculado y calendario mensual de caja.
- Registro de gasto personal y saldo negativo coherente.
- Inventario: inicial 10, salidas 8, costo 100 y mínimo 3 → existencia 2, valor 200 y alerta de reposición.
- Diseño en escritorio de 1440 px y móvil de 390 px. La página móvil de inventario no presentó desbordamiento horizontal de documento.
- Logotipo UNI visible y conservando sus proporciones.
- Acción de respaldo genera la notificación de descarga. La validación e intercambio JSON se prueban automáticamente; no se completó una prueba de selección de archivo/importación en el navegador automatizado.

Los registros temporales se retiraron después de estas pruebas. El estado inicial definido en el código permanece vacío.

## Supuestos que debe conocer el docente

No hay conversión de monedas, contabilidad transaccional, facturación ni cálculo legal de impuestos. C-V-U y presupuesto operativo modelan un producto o mezcla constante. Crédito liquidado al siguiente mes. Datos guardados en el navegador. Los criterios completos están en README y en los avisos de cada módulo.
