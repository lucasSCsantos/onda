# 01: Base visual e ícones

**What to build:** o acabamento visual compartilhado que o resto da renovação usa, aplicado já aos botões que existem hoje. Quem usa o app no celular passa a ver botões que parecem clicáveis e que afundam ao toque, nos temas claro e escuro. A paleta e o modo escuro continuam como estão; muda o acabamento.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `lucide-react` é adicionado como dependência e usado em pelo menos os botões "Novo Evento" e "Sair".
- [ ] Existe um conjunto reutilizável de botões (primário preenchido, secundário com contorno) com área de toque mínima de 44px, cantos arredondados e sombra suave.
- [ ] Todo botão e link clicável ganha estado `:active` visível (fundo mais escuro e leve escala) e transição curta (cerca de 150ms).
- [ ] O destaque de toque nativo do navegador fica desligado, e o `:active` o substitui.
- [ ] A hierarquia de texto (títulos e rótulos) e os selos de Status ficam mais legíveis, sem mudar de lugar.
- [ ] Tudo funciona nos temas claro e escuro, sem regressão de contraste.
- [ ] `pnpm typecheck`, `pnpm lint` e `pnpm test` passam; o toque é verificado à mão no celular.
