import { Marca } from "./marca";
import { AlternarTema } from "./tema";

export function Rodape() {
  return (
    <footer className="mt-auto flex items-center justify-between gap-4 border-t border-borda px-4 py-4 text-texto-suave">
      <div className="flex items-center gap-4">
        <Marca qual="logomarca" rotulo="ONDA" className="h-6 w-8 text-destaque" />
        <Marca qual="igreja" rotulo="IBAM Ondina" className="h-8 w-14" />
      </div>
      <AlternarTema />
    </footer>
  );
}
