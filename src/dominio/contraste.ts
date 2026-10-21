/** Contraste entre duas cores `#rrggbb`, pela fórmula da WCAG (de 1 a 21). */
export function razaoDeContraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

function luminancia(cor: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const canal = parseInt(cor.slice(i, i + 2), 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
