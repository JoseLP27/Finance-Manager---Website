// Gráficos nativos de Excel para el libro exportado.
//
// ExcelJS no crea gráficos, así que después de generar el .xlsx se abre el paquete
// (es un ZIP) con JSZip y se agregan las partes DrawingML: xl/charts/chartN.xml,
// xl/drawings/drawingN.xml, sus relaciones y los tipos de contenido. Cada serie
// apunta a rangos de celdas (<c:f>), por lo que el gráfico se actualiza cuando el
// usuario cambia los datos en Excel.

const NS = {
  c: "http://schemas.openxmlformats.org/drawingml/2006/chart",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  xdr: "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
};
const REL_DRAWING = `${NS.r}/drawing`;
const REL_CHART = `${NS.r}/chart`;
const CT_DRAWING = "application/vnd.openxmlformats-officedocument.drawing+xml";
const CT_CHART =
  "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";

const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Referencia absoluta a un rango: ref("01_Panel", "B14:B15") → '01_Panel'!$B$14:$B$15 */
export const ref = (sheet, range) =>
  `'${sheet.replaceAll("'", "''")}'!` +
  range
    .split(":")
    .map((a) => a.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2"))
    .join(":");

const fill = (hex) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
const line = (hex, w = 28575) =>
  `<a:ln w="${w}" cap="rnd">${fill(hex)}<a:round/></a:ln>`;
const txt = (size, bold = false, color = "404040") =>
  `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}">${fill(color)}</a:defRPr></a:pPr><a:endParaRPr lang="es-NI"/></a:p></c:txPr>`;
const title = (text, size = 1300) =>
  `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="1">${fill("1F3A5F")}</a:defRPr></a:pPr><a:r><a:rPr lang="es-NI" sz="${size}" b="1">${fill("1F3A5F")}</a:rPr><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
const strRef = (f) => `<c:strRef><c:f>${esc(f)}</c:f></c:strRef>`;
const numRef = (f) => `<c:numRef><c:f>${esc(f)}</c:f></c:numRef>`;
const serName = (s) =>
  s.nameRef
    ? `<c:tx>${strRef(s.nameRef)}</c:tx>`
    : `<c:tx><c:v>${esc(s.name ?? "")}</c:v></c:tx>`;
const gridlines = `<c:majorGridlines><c:spPr><a:ln w="6350">${fill("E5E9F0")}</a:ln></c:spPr></c:majorGridlines>`;
const noLine = `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>`;
const axisLine = `<c:spPr><a:ln w="9525">${fill("BFC7D5")}</a:ln></c:spPr>`;

function catAx(id, cross, axTitle) {
  return `<c:catAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${axTitle ? title(axTitle, 1000) : ""}<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>${axisLine}${txt(900)}<c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
}
function valAx(
  id,
  cross,
  {
    pos = "l",
    fmt = "#,##0",
    axTitle,
    grid = true,
    crossBetween = "between",
  } = {},
) {
  return `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${pos}"/>${grid ? gridlines : ""}${axTitle ? title(axTitle, 1000) : ""}<c:numFmt formatCode="${esc(fmt)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${noLine}${txt(900)}<c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:crossBetween val="${crossBetween}"/></c:valAx>`;
}
const legend = (pos = "b") =>
  `<c:legend><c:legendPos val="${pos}"/><c:overlay val="0"/>${txt(900)}</c:legend>`;
const dataLabels = (fmt, { pos, percent = false } = {}) =>
  `<c:dLbls><c:numFmt formatCode="${esc(fmt)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txt(800, true, "1F3A5F")}${pos ? `<c:dLblPos val="${pos}"/>` : ""}<c:showLegendKey val="0"/><c:showVal val="${percent ? 0 : 1}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${percent ? 1 : 0}"/><c:showBubbleSize val="0"/>${percent ? '<c:showLeaderLines val="1"/>' : ""}</c:dLbls>`;

function wrap(spec, plot) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${NS.c}" xmlns:a="${NS.a}" xmlns:r="${NS.r}"><c:date1904 val="0"/><c:lang val="es-NI"/><c:roundedCorners val="0"/><c:chart>${title(spec.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}</c:plotArea>${spec.legend === false ? "" : legend(spec.legendPos)}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr>${fill("FFFFFF")}<a:ln w="9525">${fill("DDE3EA")}</a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="es-NI"/></a:p></c:txPr><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

/**
 * spec.type:
 *  "bar"      → columnas agrupadas. series: [{ name|nameRef, cat, val, color }]
 *  "line"     → líneas con categorías. Igual que bar.
 *  "scatter"  → líneas X-Y (eje X numérico). series: [{ name|nameRef, x, y, color }]
 *  "doughnut" → anillo. series: [{ name|nameRef, cat, val }], colors: [...]
 * Opcionales: title, fmt (formato del eje/etiquetas), xTitle, yTitle, labels (bool)
 */
export function chartXml(spec) {
  const fmt = spec.fmt ?? "#,##0";
  if (spec.type === "doughnut") {
    const s = spec.series[0];
    const points = spec.colors
      .map(
        (hex, i) =>
          `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(hex)}<a:ln w="19050">${fill("FFFFFF")}</a:ln></c:spPr></c:dPt>`,
      )
      .join("");
    return wrap(
      { ...spec, legendPos: "r" },
      `<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${serName(s)}${points}${dataLabels("0%", { percent: true })}<c:cat>${strRef(s.cat)}</c:cat><c:val>${numRef(s.val)}</c:val></c:ser><c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`,
    );
  }
  if (spec.type === "scatter") {
    const series = spec.series
      .map(
        (s, i) =>
          `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${serName(s)}<c:spPr>${line(s.color)}</c:spPr><c:marker><c:symbol val="none"/></c:marker><c:xVal>${numRef(s.x)}</c:xVal><c:yVal>${numRef(s.y)}</c:yVal><c:smooth val="0"/></c:ser>`,
      )
      .join("");
    return wrap(
      spec,
      `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${series}<c:axId val="5001"/><c:axId val="5002"/></c:scatterChart>${valAx(5001, 5002, { pos: "b", fmt: spec.xFmt ?? "#,##0", axTitle: spec.xTitle, grid: false, crossBetween: "midCat" })}${valAx(5002, 5001, { fmt, axTitle: spec.yTitle, crossBetween: "midCat" })}`,
    );
  }
  const isLine = spec.type === "line";
  const series = spec.series
    .map((s, i) => {
      const look = isLine
        ? `<c:spPr>${line(s.color)}</c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${fill(s.color)}<a:ln>${fill("FFFFFF")}</a:ln></c:spPr></c:marker>`
        : `<c:spPr>${fill(s.color)}</c:spPr><c:invertIfNegative val="0"/>`;
      const labels =
        spec.labels === false
          ? ""
          : dataLabels(fmt, { pos: isLine ? "t" : "outEnd" });
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${serName(s)}${look}${labels}<c:cat>${strRef(s.cat)}</c:cat><c:val>${numRef(s.val)}</c:val>${isLine ? '<c:smooth val="0"/>' : ""}</c:ser>`;
    })
    .join("");
  const body = isLine
    ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>`
    : `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="80"/><c:overlap val="-10"/><c:axId val="5001"/><c:axId val="5002"/></c:barChart>`;
  return wrap(
    spec,
    `${body}${catAx(5001, 5002, spec.xTitle)}${valAx(5002, 5001, { fmt, axTitle: spec.yTitle })}`,
  );
}

const EMU_PER_PX = 9525;
function drawingXml(anchors) {
  const frames = anchors
    .map(
      (a, i) =>
        `<xdr:oneCellAnchor><xdr:from><xdr:col>${a.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${Math.round(a.width * EMU_PER_PX)}" cy="${Math.round(a.height * EMU_PER_PX)}"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="${esc(a.name)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS.c}"><c:chart xmlns:c="${NS.c}" xmlns:r="${NS.r}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="${NS.xdr}" xmlns:a="${NS.a}">${frames}</xdr:wsDr>`;
}
const relsXml = (rels) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS.rel}">${rels
    .map(
      (r) =>
        `<Relationship Id="${r.id}" Type="${r.type}" Target="${esc(r.target)}"${r.external ? ' TargetMode="External"' : ""}/>`,
    )
    .join("")}</Relationships>`;

function parseRels(xml) {
  return [...xml.matchAll(/<Relationship\b([^>]*)\/>/g)].map(([, attrs]) => {
    const get = (k) => attrs.match(new RegExp(`${k}="([^"]*)"`))?.[1];
    return {
      id: get("Id"),
      type: get("Type"),
      target: get("Target")
        ?.replaceAll("&apos;", "'")
        .replaceAll("&quot;", '"')
        .replaceAll("&amp;", "&"),
      external: get("TargetMode") === "External",
    };
  });
}
const unescapeXml = (s) =>
  s
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

// Elementos que deben ir después de <drawing> en una hoja (orden del esquema OOXML).
const AFTER_DRAWING = [
  "<legacyDrawing",
  "<legacyDrawingHF",
  "<drawingHF",
  "<picture",
  "<oleObjects",
  "<controls",
  "<webPublishItems",
  "<tableParts",
  "<extLst",
];

/**
 * Inserta gráficos en un .xlsx ya generado.
 * @param {ArrayBuffer|Uint8Array|Buffer} buffer  salida de workbook.xlsx.writeBuffer()
 * @param {Record<string, Array>} charts  { "Nombre de hoja": [{ spec, col, row, width, height }] }
 *        col/row son índices base 0 de la celda superior izquierda; width/height en píxeles.
 * @param {*} JSZip  constructor de JSZip
 */
export async function injectCharts(buffer, charts, JSZip) {
  const zip = await JSZip.loadAsync(buffer);
  const workbook = await zip.file("xl/workbook.xml").async("string");
  const wbRels = parseRels(
    await zip.file("xl/_rels/workbook.xml.rels").async("string"),
  );
  const sheetFile = {};
  for (const [, attrs] of workbook.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const name = unescapeXml(attrs.match(/name="([^"]*)"/)[1]);
    const rid = attrs.match(/r:id="([^"]*)"/)[1];
    const target = wbRels
      .find((r) => r.id === rid)
      .target.replace(/^\/?xl\//, "");
    sheetFile[name] = `xl/${target}`;
  }
  let types = await zip.file("[Content_Types].xml").async("string");
  const overrides = [];
  let chartNo = 0,
    drawingNo = 0;
  for (const [sheetName, list] of Object.entries(charts)) {
    if (!list?.length || !sheetFile[sheetName]) continue;
    drawingNo += 1;
    const drawingPath = `xl/drawings/drawing${drawingNo}.xml`;
    const drawingRels = [];
    list.forEach((item, i) => {
      chartNo += 1;
      zip.file(`xl/charts/chart${chartNo}.xml`, chartXml(item.spec));
      overrides.push([`/xl/charts/chart${chartNo}.xml`, CT_CHART]);
      drawingRels.push({
        id: `rId${i + 1}`,
        type: REL_CHART,
        target: `../charts/chart${chartNo}.xml`,
      });
    });
    zip.file(
      drawingPath,
      drawingXml(
        list.map((item, i) => ({ ...item, name: `Gráfico ${i + 1}` })),
      ),
    );
    zip.file(
      `xl/drawings/_rels/drawing${drawingNo}.xml.rels`,
      relsXml(drawingRels),
    );
    overrides.push([`/${drawingPath}`, CT_DRAWING]);

    // Relación hoja → dibujo (se conservan las relaciones existentes, p. ej. hipervínculos).
    const sheetPath = sheetFile[sheetName];
    const relsPath = sheetPath.replace(
      /worksheets\/(.*)$/,
      "worksheets/_rels/$1.rels",
    );
    const existing = zip.file(relsPath)
      ? parseRels(await zip.file(relsPath).async("string"))
      : [];
    let n = existing.length + 1;
    while (existing.some((r) => r.id === `rId${n}`)) n += 1;
    const rid = `rId${n}`;
    existing.push({
      id: rid,
      type: REL_DRAWING,
      target: `../drawings/drawing${drawingNo}.xml`,
    });
    zip.file(relsPath, relsXml(existing));

    let sheet = await zip.file(sheetPath).async("string");
    const tag = `<drawing r:id="${rid}"/>`;
    const at = AFTER_DRAWING.map((t) => sheet.indexOf(t)).filter((i) => i >= 0);
    const pos = at.length ? Math.min(...at) : sheet.lastIndexOf("</worksheet>");
    sheet = sheet.slice(0, pos) + tag + sheet.slice(pos);
    zip.file(sheetPath, sheet);
  }
  const extra = overrides
    .map(([part, ct]) => `<Override PartName="${part}" ContentType="${ct}"/>`)
    .join("");
  types = types.replace("</Types>", `${extra}</Types>`);
  zip.file("[Content_Types].xml", types);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
