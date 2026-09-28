/**
 * Acceso al portal de asociaciones. El manifest es público: solo guarda sal + hash PBKDF2
 * (nunca la contraseña). Usa Web Crypto, así que corre igual en el navegador (HTTPS o
 * localhost) y en Node ≥ 20.
 */

export const PORTAL_ITERACIONES = 210000;
const MIN_PASSWORD = 10;
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

/** { sal, hash, iteraciones } válido o null. */
export function normalizePortal(v) {
  if (!v || typeof v !== "object") return null;
  const sal = String(v.sal || "");
  const hash = String(v.hash || "");
  const iteraciones = Number(v.iteraciones) || PORTAL_ITERACIONES;
  if (!/^[0-9a-f]{32}$/.test(sal) || !/^[0-9a-f]{64}$/.test(hash)) return null;
  return { sal, hash, iteraciones };
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

export async function hashPassword(password, salHex, iteraciones = PORTAL_ITERACIONES) {
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

/** Crea el registro { sal, hash, iteraciones } para guardar en la asociación. */
export async function crearAccesoPortal(password) {
  const limpio = validarPassword(password);
  const sal = toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(limpio, sal, PORTAL_ITERACIONES);
  return { sal, hash, iteraciones: PORTAL_ITERACIONES };
}

/** true si la contraseña corresponde al registro del portal. */
export async function verificarPassword(password, portal) {
  const p = normalizePortal(portal);
  if (!p || !String(password ?? "").trim()) return false;
  const hash = await hashPassword(password, p.sal, p.iteraciones);
  return hash === p.hash;
}
