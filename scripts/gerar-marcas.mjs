// Gera, a partir dos SVGs em assets/, os ícones do PWA e os componentes das marcas.
// Rodar com `pnpm gerar:marcas` sempre que uma logo em assets/ mudar.
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const AZUL_ESCURO = "#284995";
const ler = (nome) => readFileSync(new URL(`../assets/${nome}`, import.meta.url), "utf8");

const logomarca = ler("logomarca_onda.svg");
const logotipo = ler("logotipo_ministério_onda.svg");
const igreja = ler("logo_igreja_ibam_ondina.svg");

// Ícones: onda branca sobre o azul escuro, com margem para a área segura dos ícones "maskable".
const ondaBranca = Buffer.from(logomarca.replace(/fill="#459ac8"/i, 'fill="#ffffff"'));
async function icone(arquivo, lado, margem) {
  const interno = Math.round(lado * (1 - 2 * margem));
  const onda = await sharp(ondaBranca, { density: 300 })
    .resize(interno, interno, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: AZUL_ESCURO } })
    .composite([{ input: onda, gravity: "center" }])
    .png()
    .toFile(new URL(`../public/icones/${arquivo}`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
}
await icone("icone-192.png", 192, 0.14);
await icone("icone-512.png", 512, 0.14);
await icone("icone-maskable-512.png", 512, 0.22);
await icone("apple-touch-icon.png", 180, 0.14);

// Componentes: o preto das logos vira currentColor para acompanhar o modo claro e escuro.
const paraComponente = (svg) =>
  svg
    .replace(/<\?xml[^>]*>\s*/, "")
    .replace(/(fill|stroke)="(black|#000000)"/gi, '$1="currentColor"')
    .replace(/<svg ([^>]*?)width="\d+" height="\d+"/, '<svg $1width="100%" height="100%"')
    .replace(/<svg /, '<svg aria-hidden="true" focusable="false" ')
    .trim();

const igrejaComCor = igreja.replace(/<svg /, '<svg fill="currentColor" ').replace(/fill="none"/, "");

writeFileSync(
  new URL("../src/components/marcas-svg.ts", import.meta.url),
  `// Gerado por scripts/gerar-marcas.mjs a partir de assets/. Não editar à mão.\n` +
    `export const LOGOMARCA_ONDA = ${JSON.stringify(paraComponente(logomarca))};\n` +
    `export const LOGOTIPO_ONDA = ${JSON.stringify(paraComponente(logotipo))};\n` +
    `export const LOGO_IGREJA = ${JSON.stringify(paraComponente(igrejaComCor))};\n`,
);
console.log("marcas geradas");
