import { createHash, randomBytes } from "node:crypto";

/** O token do endereço: 32 bytes aleatórios (256 bits), em texto seguro para URL. Só é mostrado uma vez. */
export const novoToken = (): string => randomBytes(32).toString("base64url");

/** O que o banco guarda do token: o SHA-256 em hexadecimal. Um token de 256 bits aleatórios dispensa sal. */
export const hashDoToken = (token: string): string => createHash("sha256").update(token).digest("hex");
