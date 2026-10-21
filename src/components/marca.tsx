import { LOGOMARCA_ONDA, LOGOTIPO_ONDA, LOGO_IGREJA } from "./marcas-svg";

const SVGS = { logomarca: LOGOMARCA_ONDA, logotipo: LOGOTIPO_ONDA, igreja: LOGO_IGREJA };

/** Logos do ONDA e da igreja, em SVG inline para seguir as cores do modo claro e escuro. */
export function Marca({
  qual,
  rotulo,
  className,
}: {
  qual: keyof typeof SVGS;
  rotulo: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={rotulo}
      className={`inline-block ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: SVGS[qual] }}
    />
  );
}
