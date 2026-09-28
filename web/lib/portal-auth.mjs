/**
 * Acceso al portal de asociaciones. El manifest es público: guarda la sal y
 * hash = SHA-256(llave), con llave = PBKDF2(contraseña). La sesión del navegador guarda la
 * llave, que solo se obtiene con la contraseña; copiar el hash del manifest no sirve.
 * Usa Web Crypto, así que corre igual en el navegador (HTTPS o localhost) y en Node ≥ 20.
 */

export const PORTAL_ITERACIONES = 210000;
/** Registros sin esta versión (hash = llave) permitían entrar copiando el manifest. */
const PORTAL_VERSION = 2;
/** El hash es público: una contraseña corta se puede adivinar sin conexión. La generada tiene 14. */
const MIN_PASSWORD = 14;
/** Sin 0/O/1/I/L para dictarla por teléfono sin confusiones. */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function subtle() {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("Este navegador no permite verificar la contraseña (se requiere HTTPS).");
  return s;
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const clean = String(hex || "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** { sal, hash, iteraciones, version } válido o null. */
export function normalizePortal(v) {
  if (!v || typeof v !== "object") return null;
  const sal = String(v.sal || "");
  const hash = String(v.hash || "");
  const iteraciones = Number(v.iteraciones) || PORTAL_ITERACIONES;
  if (Number(v.version) !== PORTAL_VERSION) return null;
  if (!/^[0-9a-f]{32}$/.test(sal) || !/^[0-9a-f]{64}$/.test(hash)) return null;
  return { sal, hash, iteraciones, version: PORTAL_VERSION };
}

/** Contraseña legible de 12 caracteres (~59 bits): "K7PM-Q9TX-2HWD". */
export function generarPassword() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function validarPassword(password) {
  const p = String(password ?? "");
  if (p.trim().length < MIN_PASSWORD) {
    const err = new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    err.statusCode = 400;
    throw err;
  }
  return p.trim();
}

async function derivarLlave(password, salHex, iteraciones = PORTAL_ITERACIONES) {
  const s = subtle();
  const key = await s.importKey("raw", new TextEncoder().encode(String(password).trim()), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await s.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(salHex), iterations: iteraciones },
    key,
    256
  );
  return toHex(new Uint8Array(bits));
}

async function hashLlave(llaveHex) {
  return toHex(new Uint8Array(await subtle().digest("SHA-256", fromHex(llaveHex))));
}

/** Crea el registro { sal, hash, iteraciones, version } para guardar en la asociación. */
export async function crearAccesoPortal(password) {
  const limpio = validarPassword(password);
  const sal = toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const llave = await derivarLlave(limpio, sal, PORTAL_ITERACIONES);
  return { sal, hash: await hashLlave(llave), iteraciones: PORTAL_ITERACIONES, version: PORTAL_VERSION };
}

/** Llave de sesión si la contraseña corresponde al registro del portal; si no, null. */
export async function llavePortal(password, portal) {
  const p = normalizePortal(portal);
  if (!p || !String(password ?? "").trim()) return null;
  const llave = await derivarLlave(password, p.sal, p.iteraciones);
  return (await hashLlave(llave)) === p.hash ? llave : null;
}

/** true si la contraseña corresponde al registro del portal. */
export async function verificarPassword(password, portal) {
  return (await llavePortal(password, portal)) !== null;
}

/** true si la llave guardada en la sesión corresponde al registro vigente del portal. */
export async function verificarLlave(llave, portal) {
  const p = normalizePortal(portal);
  if (!p || !/^[0-9a-f]{64}$/.test(String(llave ?? ""))) return false;
  return (await hashLlave(llave)) === p.hash;
}
