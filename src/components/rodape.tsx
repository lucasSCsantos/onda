import { Marca } from "./marca";
import { AlternarTema } from "./tema";

export function Rodape() {
  return (
    <footer className="mt-auto flex items-center justify-between gap-4 border-t border-borda px-4 py-4 text-texto-suave">
      <Marca qual="igreja" rotulo="IBAM Ondina" className="h-8 w-14" />
      <AlternarTema />
    </footer>
  );
}
