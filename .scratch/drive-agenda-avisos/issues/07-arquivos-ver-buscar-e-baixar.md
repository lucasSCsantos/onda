# 07: Arquivos: ver, buscar e baixar

**Spec:** `../spec.md` (Alteração 4)

**What to build:** Em "Arquivos", imagens ganham miniaturas e pré-visualização ampliada por endpoints do próprio app, os demais arquivos mostram ícone por tipo, nome, tamanho e data, e cada arquivo tem abrir no Drive, copiar link e baixar (com limite de tamanho). A busca por nome cobre a raiz inteira com um índice em cache. O link da Pasta do Evento abre direto em Arquivos, na pasta certa.

**Blocked by:** 06 (Arquivos: navegar)

**Status:** ready-for-agent

- [ ] Miniaturas e pré-visualização servidas por endpoints do app, com checagem de permissão e raiz, e cache
- [ ] Ações abrir no Drive, copiar link e baixar; o download passa pelo servidor com limite configurável (padrão 4 MB) e arquivos maiores só têm "Abrir no Drive"
- [ ] Busca por nome na raiz inteira com índice em cache de 5 minutos e teto de pastas percorridas; se estourar, avisa e usa só a pasta atual
- [ ] O link do Evento oferece "Abrir em Arquivos" na pasta certa quando a Pasta do Evento está dentro da raiz
- [ ] Item pedido fora da raiz é negado em miniatura, pré-visualização e download
- [ ] Testes com o Drive falso (bloqueio fora da raiz, limite de download, busca com cache, erro da integração)
