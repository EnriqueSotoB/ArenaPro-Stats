/**
 * Imagen para redes (Facebook / Instagram) dibujada en <canvas>, sin dependencias.
 * Tokens: mismos colores que css/styles.css.
 */

export const FORMATOS = {
  post: { id: "post", label: "Post 4:5", w: 1080, h: 1350, maxFilas: 10, safeTop: 0, safeBottom: 0 },
  cuadrado: { id: "cuadrado", label: "Cuadrado", w: 1080, h: 1080, maxFilas: 7, safeTop: 0, safeBottom: 0 },
  historia: { id: "historia", label: "Historia 9:16", w: 1080, h: 1920, maxFilas: 12, safeTop: 160, safeBottom: 170 },
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

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{
 *   kicker?: string, linea?: string, titulo: string, subtitulo?: string,
 *   filas: Array<{ lugar: number|string, nombre: string, detalle?: string, valor: string }>,
 *   pie?: string, sitio?: string, logo?: string
 * }} spec
 * @param {keyof typeof FORMATOS} formatoId
 */
export async function drawSocialCard(canvas, spec, formatoId = "post") {
  const f = FORMATOS[formatoId] || FORMATOS.post;
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

  const tituloSize = fitFontSize(ctx, spec.titulo, 800, formatoId === "cuadrado" ? 76 : 88, 48, headW);
  y += tituloSize;
  ctx.fillStyle = C.cream;
  ctx.fillText(fitText(ctx, spec.titulo, headW), PAD, y);
  y += 22;

  ctx.fillStyle = C.ochre;
  ctx.fillRect(PAD, y, 120, 8);
  y += 8;

  if (spec.subtitulo) {
    y += 44;
    setFont(ctx, 400, 30, SANS);
    ctx.fillStyle = C.sand;
    ctx.fillText(fitText(ctx, spec.subtitulo, innerW), PAD, y);
  }
  y += 32;

  const footerH = 96;
  const footerTop = H - PAD - f.safeBottom - footerH;
  const filas = (spec.filas || []).slice(0, f.maxFilas);

  if (!filas.length) {
    setFont(ctx, 700, 34, SANS);
    ctx.fillStyle = C.sand;
    ctx.fillText("Sin resultados todavía", PAD, y + 60);
  } else {
    const avail = footerTop - 24 - y;
    const slot = Math.min(110, avail / filas.length);
    const rowH = slot * 0.88;
    const radius = Math.min(18, rowH / 3);
    filas.forEach((fila, i) => {
      const top = y + i * slot;
      const first = i === 0;
      roundRect(ctx, PAD, top, innerW, rowH, radius);
      ctx.fillStyle = first ? C.ochre : i % 2 ? "#efe9dd" : C.cream;
      ctx.fill();

      const mid = top + rowH / 2;
      const circleR = rowH * 0.32;
      const cx = PAD + 28 + circleR;
      ctx.beginPath();
      ctx.arc(cx, mid, circleR, 0, Math.PI * 2);
      ctx.fillStyle = first ? C.dark : i < 3 ? C.forest : C.sand;
      ctx.fill();
      setFont(ctx, 800, Math.round(circleR * 1.05));
      ctx.fillStyle = first || i < 3 ? C.cream : C.dark;
      ctx.textAlign = "center";
      ctx.fillText(String(fila.lugar), cx, mid + circleR * 0.36);

      const valorSize = Math.round(Math.min(44, rowH * 0.47));
      setFont(ctx, 800, valorSize);
      ctx.textAlign = "right";
      ctx.fillStyle = first ? C.dark : C.forest;
      const valorX = PAD + innerW - 28;
      ctx.fillText(fila.valor, valorX, mid + valorSize * 0.36);
      const valorW = ctx.measureText(fila.valor).width;

      ctx.textAlign = "left";
      const nameX = cx + circleR + 24;
      const nameMaxW = valorX - valorW - 28 - nameX;
      const nameSize = Math.round(Math.min(40, rowH * 0.46));
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
    });
  }

  const fy = footerTop + footerH / 2;
  ctx.strokeStyle = "rgba(221, 210, 188, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, footerTop);
  ctx.lineTo(W - PAD, footerTop);
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

