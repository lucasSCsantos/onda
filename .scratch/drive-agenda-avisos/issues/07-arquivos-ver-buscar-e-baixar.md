# 07: Arquivos: ver, buscar e baixar

**Spec:** `../spec.md` (Alteração 4)

**What to build:** Em "Arquivos", imagens ganham miniaturas e pré-visualização ampliada por endpoints do próprio app, os demais arquivos mostram ícone por tipo, nome, tamanho e data, e cada arquivo tem abrir no Drive, copiar link e baixar (com limite de tamanho). A busca por nome cobre a raiz inteira com um índice em cache. O link da Pasta do Evento abre direto em Arquivos, na pasta certa.

**Blocked by:** 06 (Arquivos: navegar)

**Status:** done

- [x] Miniaturas e pré-visualização servidas por endpoints do app, com checagem de permissão e raiz, e cache
- [x] Ações abrir no Drive, copiar link e baixar; o download passa pelo servidor com limite configurável (padrão 4 MB) e arquivos maiores só têm "Abrir no Drive"
- [x] Busca por nome na raiz inteira com índice em cache de 5 minutos e teto de pastas percorridas; se estourar, avisa e usa só a pasta atual
- [x] O link do Evento oferece "Abrir em Arquivos" na pasta certa quando a Pasta do Evento está dentro da raiz
- [x] Item pedido fora da raiz é negado em miniatura, pré-visualização e download
- [x] Testes com o Drive falso (bloqueio fora da raiz, limite de download, busca com cache, erro da integração)

## Comments

- Entregue. Limitações a registrar: miniatura e imagem ampliada não têm cache no servidor (só `private, max-age=300` no navegador; o Drive é consultado a cada miniatura nova); o cache de metadados e o índice vivem na memória de cada instância e valem 3 e 5 minutos, então um item movido para fora da raiz pode continuar servido até esse prazo ("Atualizar" limpa só a instância atual); com atalho escolhido a busca vale só dentro da pasta do atalho; o limite de download vai até 50 MB, mas a hospedagem costuma limitar a resposta a cerca de 4,5 MB; o clique em "Ampliar" e "Copiar link" é teste manual (sem teste de interface). Migration `20261023180000_arquivos_ver_e_buscar.sql`.
