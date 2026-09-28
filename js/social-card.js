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

/** Alto del encabezado con el título a su tamaño máximo (cota para planear páginas). */
function headerBottom(f, spec, tituloSize = f.tituloMax) {
  let y = PAD + f.safeTop + 20;
  if (spec.kicker) y += 50;
  if (spec.linea) y += 22;
  y += tituloSize + 22 + 8;
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
  const filas = (spec?.filas || []).slice(0, top.n);
  if (!filas.length) return [{ filas: [], columnas: 1 }];

  const avail = footerTop(f) - 24 - headerBottom(f, spec);
  if (avail / filas.length >= SLOT_MIN_UNA) return [{ filas, columnas: 1 }];

  const porImagen = Math.max(2, Math.floor(avail / SLOT_MIN_DOBLE) * 2);
  const total = Math.ceil(filas.length / porImagen);
  const porPagina = Math.ceil(filas.length / total);
  const paginas = [];
  for (let i = 0; i < filas.length; i += porPagina) {
    paginas.push({ filas: filas.slice(i, i + porPagina), columnas: 2 });
  }
  return paginas;
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
  const circleR = Math.min(rowH * (doble ? 0.34 : 0.32), podio ? 50 : 40);
  const cx = x + inset + circleR;
  ctx.beginPath();
  ctx.arc(cx, mid, circleR, 0, Math.PI * 2);
  ctx.fillStyle = first ? C.dark : podium ? C.forest : C.sand;
  ctx.fill();
  setFont(ctx, 800, Math.round(circleR * (String(fila.lugar).length > 2 ? 0.8 : 1.05)));
  ctx.fillStyle = first || podium ? C.cream : C.dark;
  ctx.textAlign = "center";
  ctx.fillText(String(fila.lugar), cx, mid + circleR * 0.36);

  const valor = doble ? fila.valorCorto || fila.valor : fila.valor;
  const valorSize = Math.round(Math.min(podio ? 62 : doble ? 32 : 44, rowH * (doble ? 0.5 : 0.47)));
  setFont(ctx, 800, valorSize);
  ctx.textAlign = "right";
  ctx.fillStyle = first ? C.dark : C.forest;
  const valorX = x + w - inset;
  ctx.fillText(valor, valorX, mid + valorSize * 0.36);
  const valorW = ctx.measureText(valor).width;

  ctx.textAlign = "left";
  const nameX = cx + circleR + (doble ? 14 : 24);
  const nameMaxW = valorX - valorW - (doble ? 14 : 28) - nameX;
  const nameMax = Math.round(Math.min(podio ? 58 : doble ? 32 : 40, rowH * (doble ? 0.5 : 0.46)));
  const nameSize = fitFontSize(ctx, fila.nombre, 700, nameMax, Math.round(nameMax * 0.7), nameMaxW);
  const hasDetalle = Boolean(fila.detalle) && rowH >= 84;
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
 *   filas: Array<{ lugar: number|string, nombre: string, detalle?: string, valor: string, valorCorto?: string }>,
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

  const badge = assocLogo ? (formatoId === "cuadrado" ? 150 : 176) : 0;
  if (assocLogo) drawAssocBadge(ctx, assocLogo, W - PAD - badge, PAD + f.safeTop - 12, badge);
  const headW = badge ? innerW - badge - 28 : innerW;

  if (spec.kicker) {
    setFont(ctx, 700, 24, SANS);
    setTracking(ctx, 2);
    ctx.fillStyle = C.ochre;
    ctx.fillText(fitText(ctx, spec.kicker.toUpperCase(), headW), PAD, y);
    setTracking(ctx, 0);
    y += 50;
  }

  if (spec.linea) {
    setFont(ctx, 700, 38);
    ctx.fillStyle = C.sand;
    ctx.fillText(fitText(ctx, spec.linea, headW), PAD, y);
    y += 22;
  }

  const tituloSize = fitFontSize(ctx, spec.titulo, 800, f.tituloMax, 48, headW);
  y += tituloSize;
  ctx.fillStyle = C.cream;
  ctx.fillText(fitText(ctx, spec.titulo, headW), PAD, y);
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
