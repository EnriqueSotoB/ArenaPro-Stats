/**
 * Imagen para redes (Facebook / Instagram) dibujada en <canvas>, sin dependencias.
 * Tokens: mismos colores que css/styles.css.
 */

export const FORMATOS = {
  post: { id: "post", label: "Post 4:5", w: 1080, h: 1350, safeTop: 0, safeBottom: 0, tituloMax: 88 },
  cuadrado: { id: "cuadrado", label: "Cuadrado", w: 1080, h: 1080, safeTop: 0, safeBottom: 0, tituloMax: 76 },
  historia: { id: "historia", label: "Historia 9:16", w: 1080, h: 1920, safeTop: 160, safeBottom: 170, tituloMax: 88 },
};

export const TOPS = {
  top3: { id: "top3", label: "Top 3", n: 3 },
  top10: { id: "top10", label: "Top 10", n: 10 },
  todos: { id: "todos", label: "Todos", n: Infinity },
};

const C = {
  forest: "#3f524f",
  forestDark: "#2a3735",
  ochre: "#dd9219",
  sand: "#ddd2bc",
  cream: "#f8f6f2",
  dark: "#3b3b3b",
  olive: "#626e67",
  sube: "#1f9d55",
  baja: "#d64534",
};

const DISPLAY = '"Archivo", Arial, Helvetica, sans-serif';
const SANS = "Arial, Helvetica, sans-serif";
const PAD = 72;
const FOOTER_H = 96;
const COL_GAP = 24;
/** Debajo de este alto por fila, una columna se lee mal en el celular: se pasa a dos. */
const SLOT_MIN_UNA = 64;
/** Alto mínimo por fila en doble columna; define cuántos caben por imagen antes de paginar. */
const SLOT_MIN_DOBLE = 50;
/** Listas con detalle (récords): siempre una columna y filas altas para que se lea la segunda línea. */
const SLOT_MIN_LISTA = 90;

/** @type {Map<string, Promise<HTMLImageElement|null>>} */
const imageCache = new Map();

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      })
    );
  }
  return imageCache.get(src);
}

/** Logo de la asociación en insignia blanca (funciona igual con JPG de fondo blanco o PNG transparente). */
function drawAssocBadge(ctx, img, x, y, size) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, x, y, size, size, size * 0.14);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();

  const pad = size * 0.08;
  const box = size - pad * 2;
  const scale = Math.min(box / img.width, box / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
}

async function ensureFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`800 80px ${DISPLAY}`),
      document.fonts.load(`700 40px ${DISPLAY}`),
    ]);
  } catch {
    /* sin red: cae a Arial */
  }
}

function setFont(ctx, weight, size, family = DISPLAY) {
  ctx.font = `${weight} ${size}px ${family}`;
}

function setTracking(ctx, px) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}

/** Recorta con "…" hasta que quepa en maxW. */
function fitText(ctx, text, maxW) {
  const s = String(text ?? "");
  if (ctx.measureText(s).width <= maxW) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${s.slice(0, mid).trimEnd()}…`).width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return `${s.slice(0, lo).trimEnd()}…`;
}

/** Baja el tamaño de fuente hasta que el texto quepa (mínimo minSize). */
function fitFontSize(ctx, text, weight, size, minSize, maxW) {
  let s = size;
  setFont(ctx, weight, s);
  while (s > minSize && ctx.measureText(text).width > maxW) {
    s -= 2;
    setFont(ctx, weight, s);
  }
  return s;
}

const TITULO_MIN = 44;
const TITULO_INTERLINEA = 1.06;

/** Parte el título en dos renglones: primero en " — ", si no donde queden más parejos. */
function partirEnDos(ctx, text, maxW) {
  const sep = text.indexOf(" — ");
  if (sep > 0) {
    const par = [`${text.slice(0, sep)} —`, text.slice(sep + 3)];
    if (par.every((l) => ctx.measureText(l).width <= maxW)) return par;
  }
  const palabras = text.split(/\s+/);
  if (palabras.length < 2) return null;
  let mejor = null;
  let mejorW = Infinity;
  for (let k = 1; k < palabras.length; k++) {
    const par = [palabras.slice(0, k).join(" "), palabras.slice(k).join(" ")];
    const w = Math.max(...par.map((l) => ctx.measureText(l).width));
    if (w < mejorW) {
      mejor = par;
      mejorW = w;
    }
  }
  return mejor;
}

/**
 * Un renglón mientras la letra no quede chica; si no, dos renglones.
 * Solo recorta con "…" si ni en dos renglones al tamaño mínimo cabe.
 * @returns {{ size: number, lineas: string[] }}
 */
function layoutTitulo(ctx, titulo, f, maxW) {
  const text = String(titulo ?? "").trim();
  const una = fitFontSize(ctx, text, 800, f.tituloMax, Math.round(f.tituloMax * 0.78), maxW);
  if (ctx.measureText(text).width <= maxW) return { size: una, lineas: [text] };

  for (let s = Math.round(f.tituloMax * 0.82); s >= TITULO_MIN; s -= 2) {
    setFont(ctx, 800, s);
    const lineas = partirEnDos(ctx, text, maxW);
    if (lineas?.every((l) => ctx.measureText(l).width <= maxW)) return { size: s, lineas };
  }
  setFont(ctx, 800, TITULO_MIN);
  const lineas = partirEnDos(ctx, text, maxW) || [text];
  return { size: TITULO_MIN, lineas: lineas.map((l) => fitText(ctx, l, maxW)) };
}

const KICKER_INTERLINEA = 32;

/** Línea de la asociación en uno o dos renglones; si se parte, corta entre siglas y nombre. */
function layoutKicker(ctx, kicker, maxW) {
  const text = String(kicker ?? "").toUpperCase();
  setFont(ctx, 700, 24, SANS);
  setTracking(ctx, 2);
  const cabe = (s) => ctx.measureText(s).width <= maxW;
  let lineas = [text];
  if (!cabe(text)) {
    const sep = text.indexOf(" · ");
    if (sep > 0 && cabe(text.slice(0, sep)) && cabe(text.slice(sep + 3))) {
      lineas = [text.slice(0, sep), text.slice(sep + 3)];
    } else {
      const palabras = text.split(/\s+/);
      let k = 1;
      while (k < palabras.length && cabe(palabras.slice(0, k + 1).join(" "))) k++;
      lineas = [fitText(ctx, palabras.slice(0, k).join(" "), maxW)];
      if (k < palabras.length) lineas.push(fitText(ctx, palabras.slice(k).join(" "), maxW));
    }
  }
  setTracking(ctx, 0);
  return lineas;
}

function altoTitulo(layout) {
  return layout.size + (layout.lineas.length - 1) * Math.round(layout.size * TITULO_INTERLINEA);
}

function badgeSize(formatoId) {
  return formatoId === "cuadrado" ? 150 : 176;
}

function tituloMaxW(f, formatoId, conLogo) {
  const innerW = f.w - PAD * 2;
  return conLogo ? innerW - badgeSize(formatoId) - 28 : innerW;
}

/** @type {CanvasRenderingContext2D|null|undefined} */
let measureCtx;

/** Renglones del encabezado para planear páginas (sin DOM, se asume un renglón de cada uno). */
function encabezadoPlan(spec, f, formatoId) {
  if (measureCtx === undefined) {
    measureCtx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  }
  const plan = { tituloAlto: f.tituloMax, kickerLineas: 1 };
  if (!measureCtx) return plan;
  const maxW = tituloMaxW(f, formatoId, Boolean(spec?.logo));
  if (spec?.titulo) {
    const layout = layoutTitulo(measureCtx, spec.titulo, f, maxW);
    if (layout.lineas.length > 1) plan.tituloAlto = altoTitulo(layout);
  }
  if (spec?.kicker) plan.kickerLineas = layoutKicker(measureCtx, spec.kicker, maxW).length;
  return plan;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, C.forest);
  g.addColorStop(1, C.forestDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = C.ochre;
  ctx.beginPath();
  ctx.moveTo(W * 0.62, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, H * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = C.ochre;
  ctx.fillRect(0, 0, W, 10);
}

/** Alto del encabezado (cota para planear páginas). */
function headerBottom(f, spec, { tituloAlto = f.tituloMax, kickerLineas = 1 } = {}) {
  let y = PAD + f.safeTop + 20;
  if (spec.kicker) y += 50 + (kickerLineas - 1) * KICKER_INTERLINEA;
  if (spec.linea) y += 22;
  y += tituloAlto + 22 + 8;
  if (spec.subtitulo) y += 44;
  return y + 32;
}

function footerTop(f) {
  return f.h - PAD - f.safeBottom - FOOTER_H;
}

/**
 * Reparte las filas del top elegido en una o varias imágenes (carrusel).
 * Una columna mientras se lea bien; si no, dos columnas; si ni así caben, varias
 * imágenes con la misma cantidad de filas cada una.
 * @returns {Array<{ filas: any[], columnas: 1|2 }>}
 */
export function planPaginas(spec, formatoId = "post", topId = "top10") {
  const f = FORMATOS[formatoId] || FORMATOS.post;
  const top = TOPS[topId] || TOPS.top10;
  const filas = (spec?.filas || []).slice(0, spec?.lista ? Infinity : top.n);
  if (!filas.length) return [{ filas: [], columnas: 1 }];

  const avail = footerTop(f) - 24 - headerBottom(f, spec, encabezadoPlan(spec, f, formatoId));
  const columnas = spec?.lista ? 1 : 2;
  if (avail / filas.length >= (spec?.lista ? SLOT_MIN_LISTA : SLOT_MIN_UNA)) return [{ filas, columnas: 1 }];

  const porImagen = spec?.lista
    ? Math.max(1, Math.floor(avail / SLOT_MIN_LISTA))
    : Math.max(2, Math.floor(avail / SLOT_MIN_DOBLE) * 2);
  const total = Math.ceil(filas.length / porImagen);
  const porPagina = Math.ceil(filas.length / total);
  const paginas = [];
  for (let i = 0; i < filas.length; i += porPagina) {
    paginas.push({ filas: filas.slice(i, i + porPagina), columnas });
  }
  return paginas;
}

/** Insignia de lugares movidos: ▲ n (verde), ▼ n (rojo), – (igual) o NUEVO. */
function drawMovimiento(ctx, mov, x, y, w, h, sobreOcre) {
  const cy = y + h / 2;
  if (mov.tipo === "igual") {
    ctx.strokeStyle = sobreOcre ? C.dark : C.olive;
    ctx.lineWidth = Math.max(3, h * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.4, cy);
    ctx.lineTo(x + w * 0.6, cy);
    ctx.stroke();
    return;
  }
  roundRect(ctx, x, y, w, h, Math.min(12, h / 3));
  ctx.fillStyle = mov.tipo === "sube" ? C.sube : mov.tipo === "baja" ? C.baja : sobreOcre ? C.dark : C.ochre;
  ctx.fill();
  if (mov.tipo === "nuevo") {
    const size = Math.round(h * 0.4);
    setFont(ctx, 800, size);
    ctx.fillStyle = sobreOcre ? C.ochre : C.dark;
    ctx.textAlign = "center";
    ctx.fillText(fitText(ctx, "NUEVO", w - 8), x + w / 2, cy + size * 0.36);
    return;
  }
  const size = Math.round(h * 0.56);
  setFont(ctx, 800, size);
  const txt = String(Math.abs(Number(mov.n) || 0));
  const tri = h * 0.34;
  const gap = h * 0.12;
  const sx = x + (w - (tri + gap + ctx.measureText(txt).width)) / 2;
  const dy = mov.tipo === "sube" ? 1 : -1;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(sx, cy + dy * tri * 0.45);
  ctx.lineTo(sx + tri, cy + dy * tri * 0.45);
  ctx.lineTo(sx + tri / 2, cy - dy * tri * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillText(txt, sx + tri + gap, cy + size * 0.36);
}

function drawRow(ctx, fila, x, top, w, rowH, { podio, doble, alterno }) {
  const lugarNum = Number(fila.lugar);
  const first = lugarNum === 1;
  const podium = lugarNum >= 1 && lugarNum <= 3;
  roundRect(ctx, x, top, w, rowH, Math.min(18, rowH / 3));
  ctx.fillStyle = first ? C.ochre : alterno ? "#efe9dd" : C.cream;
  ctx.fill();

  const mid = top + rowH / 2;
  const inset = doble ? 16 : 28;
  const conLugar = fila.lugar !== "" && fila.lugar != null;
  const circleR = conLugar ? Math.min(rowH * (doble ? 0.34 : 0.32), podio ? 50 : 40) : 0;
  const cx = x + inset + circleR;
  if (conLugar) {
    ctx.beginPath();
    ctx.arc(cx, mid, circleR, 0, Math.PI * 2);
    ctx.fillStyle = first ? C.dark : podium ? C.forest : C.sand;
    ctx.fill();
    setFont(ctx, 800, Math.round(circleR * (String(fila.lugar).length > 2 ? 0.8 : 1.05)));
    ctx.fillStyle = first || podium ? C.cream : C.dark;
    ctx.textAlign = "center";
    ctx.fillText(String(fila.lugar), cx, mid + circleR * 0.36);
  }

  let valorX = x + w - inset;
  if (fila.movimiento) {
    const bw = doble ? 70 : podio ? 104 : 100;
    const bh = Math.min(rowH * 0.62, podio ? 60 : doble ? 40 : 52);
    drawMovimiento(ctx, fila.movimiento, valorX - bw, mid - bh / 2, bw, bh, first);
    valorX -= bw + (doble ? 12 : 20);
  }

  const valor = doble ? fila.valorCorto || fila.valor : fila.valor;
  const valorMax = podio ? (fila.movimiento ? 46 : 62) : doble ? 32 : 44;
  const valorSize = Math.round(Math.min(valorMax, rowH * (doble ? 0.5 : 0.47)));
  setFont(ctx, 800, valorSize);
  ctx.textAlign = "right";
  ctx.fillStyle = first ? C.dark : C.forest;
  ctx.fillText(valor, valorX, mid + valorSize * 0.36);
  const valorW = ctx.measureText(valor).width;

  ctx.textAlign = "left";
  const nameX = conLugar ? cx + circleR + (doble ? 14 : 24) : x + inset;
  const nameMaxW = valorX - valorW - (doble ? 14 : 28) - nameX;
  const nameMax = Math.round(Math.min(podio ? 58 : doble ? 32 : 40, rowH * (doble ? 0.5 : 0.46)));
  const nameSize = fitFontSize(ctx, fila.nombre, 700, nameMax, Math.round(nameMax * 0.7), nameMaxW);
  const hasDetalle = Boolean(fila.detalle) && rowH >= 78;
  setFont(ctx, 700, nameSize);
  ctx.fillStyle = C.dark;
  const nameY = hasDetalle ? mid - 2 : mid + nameSize * 0.36;
  ctx.fillText(fitText(ctx, fila.nombre, nameMaxW), nameX, nameY);
  if (hasDetalle) {
    const detSize = Math.round(nameSize * 0.62);
    setFont(ctx, 400, detSize, SANS);
    ctx.fillStyle = first ? C.dark : C.olive;
    ctx.fillText(fitText(ctx, fila.detalle, nameMaxW), nameX, mid + detSize + 6);
  }
}

function drawFilas(ctx, pagina, y, bottom, innerW, podio) {
  const avail = bottom - y;
  if (pagina.columnas === 1) {
    const n = pagina.filas.length;
    const slot = Math.min(podio ? 230 : 110, avail / n);
    const offset = podio ? Math.max(0, (avail - slot * n) / 2) : 0;
    pagina.filas.forEach((fila, i) => {
      drawRow(ctx, fila, PAD, y + offset + i * slot, innerW, slot * 0.88, {
        podio,
        doble: false,
        alterno: i % 2 === 1,
      });
    });
    return;
  }
  const porColumna = Math.ceil(pagina.filas.length / 2);
  const colW = (innerW - COL_GAP) / 2;
  const slot = Math.min(112, avail / porColumna);
  pagina.filas.forEach((fila, i) => {
    const col = Math.floor(i / porColumna);
    const row = i % porColumna;
    drawRow(ctx, fila, PAD + col * (colW + COL_GAP), y + row * slot, colW, slot * 0.86, {
      podio: false,
      doble: true,
      alterno: row % 2 === 1,
    });
  });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   kicker?: string, linea?: string, titulo: string, subtitulo?: string,
 *   filas: Array<{
 *     lugar: number|string, nombre: string, detalle?: string, valor: string, valorCorto?: string,
 *     movimiento?: { tipo: "sube"|"baja"|"igual"|"nuevo", n?: number }
 *   }>,
 *   pie?: string, sitio?: string, logo?: string
 * }} spec
 * @param {keyof typeof FORMATOS} formatoId
 * @param {{ filas: any[], columnas: 1|2, indice?: number, total?: number }} [pagina] de planPaginas
 */
export async function drawSocialCard(canvas, spec, formatoId = "post", pagina) {
  const f = FORMATOS[formatoId] || FORMATOS.post;
  const pag = pagina || { ...planPaginas(spec, formatoId, "top10")[0], indice: 0, total: 1 };
  await ensureFonts();
  const [logo, assocLogo] = await Promise.all([
    loadImage("assets/icons/icon-512.png"),
    loadImage(spec.logo),
  ]);

  canvas.width = f.w;
  canvas.height = f.h;
  const ctx = canvas.getContext("2d");
  const W = f.w;
  const H = f.h;
  const innerW = W - PAD * 2;

  drawBackground(ctx, W, H);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  let y = PAD + f.safeTop + 20;

  const badge = assocLogo ? badgeSize(formatoId) : 0;
  if (assocLogo) drawAssocBadge(ctx, assocLogo, W - PAD - badge, PAD + f.safeTop - 12, badge);
  const headW = tituloMaxW(f, formatoId, Boolean(assocLogo));

  if (spec.kicker) {
    const lineas = layoutKicker(ctx, spec.kicker, headW);
    setFont(ctx, 700, 24, SANS);
    setTracking(ctx, 2);
    ctx.fillStyle = C.ochre;
    lineas.forEach((linea, i) => ctx.fillText(linea, PAD, y + i * KICKER_INTERLINEA));
    setTracking(ctx, 0);
    y += 50 + (lineas.length - 1) * KICKER_INTERLINEA;
  }

  if (spec.linea) {
    setFont(ctx, 700, 38);
    ctx.fillStyle = C.sand;
    ctx.fillText(fitText(ctx, spec.linea, headW), PAD, y);
    y += 22;
  }

  const titulo = layoutTitulo(ctx, spec.titulo, f, headW);
  setFont(ctx, 800, titulo.size);
  ctx.fillStyle = C.cream;
  titulo.lineas.forEach((linea, i) => {
    y += i === 0 ? titulo.size : Math.round(titulo.size * TITULO_INTERLINEA);
    ctx.fillText(linea, PAD, y);
  });
  y += 22;

  ctx.fillStyle = C.ochre;
  ctx.fillRect(PAD, y, 120, 8);
  y += 8;

  const paginado = (pag.total || 1) > 1;
  if (spec.subtitulo || paginado) {
    y += 44;
    if (paginado) {
      setFont(ctx, 800, 30);
      ctx.fillStyle = C.ochre;
      ctx.textAlign = "right";
      ctx.fillText(`${(pag.indice || 0) + 1}/${pag.total}`, W - PAD, y);
      ctx.textAlign = "left";
    }
    if (spec.subtitulo) {
      setFont(ctx, 400, 30, SANS);
      ctx.fillStyle = C.sand;
      ctx.fillText(fitText(ctx, spec.subtitulo, paginado ? innerW - 110 : innerW), PAD, y);
    }
  }
  y += 32;

  const fTop = footerTop(f);
  if (!pag.filas.length) {
    setFont(ctx, 700, 34, SANS);
    ctx.fillStyle = C.sand;
    ctx.fillText("Sin resultados todavía", PAD, y + 60);
  } else {
    const podio = pag.columnas === 1 && pag.filas.length <= 3;
    drawFilas(ctx, pag, y, fTop - 24, innerW, podio);
  }

  const fy = fTop + FOOTER_H / 2;
  ctx.strokeStyle = "rgba(221, 210, 188, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, fTop);
  ctx.lineTo(W - PAD, fTop);
  ctx.stroke();

  let fx = PAD;
  if (logo) {
    const s = 64;
    ctx.save();
    roundRect(ctx, fx, fy - s / 2 + 8, s, s, 12);
    ctx.clip();
    ctx.drawImage(logo, fx, fy - s / 2 + 8, s, s);
    ctx.restore();
    fx += s + 20;
  }
  setFont(ctx, 800, 30);
  ctx.fillStyle = C.cream;
  ctx.textAlign = "left";
  ctx.fillText("ArenaPro Estadísticas", fx, fy + 4);
  setFont(ctx, 400, 24, SANS);
  ctx.fillStyle = C.ochre;
  ctx.fillText(spec.sitio || "estadisticas.arenapro.mx", fx, fy + 38);

  if (spec.pie) {
    setFont(ctx, 400, 24, SANS);
    ctx.fillStyle = C.sand;
    ctx.textAlign = "right";
    ctx.fillText(fitText(ctx, spec.pie, innerW * 0.4), W - PAD, fy + 38);
  }
  ctx.textAlign = "left";
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen."))), "image/png");
  });
}
