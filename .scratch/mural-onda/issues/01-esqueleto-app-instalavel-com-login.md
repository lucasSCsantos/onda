# 01: Esqueleto: app instalável com login

**What to build:** o app mais fino possível, de ponta a ponta: uma pessoa abre o Mural ONDA no celular, instala na tela inicial, entra com e-mail e senha, sai e recupera a senha. Inclui a base técnica que o resto depende: projeto Next.js (TypeScript) como PWA, Supabase local, deploy automático do GitHub, identidade visual do ONDA (azuis das logos, modo claro e escuro, pt-BR, logo da igreja no rodapé) e os dois pontos de teste da spec (módulo de domínio em TypeScript puro e políticas por linha contra um Postgres local), cada um com um teste de exemplo passando.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O app instala como PWA no celular, com ícone e tela de abertura do ONDA
- [ ] Login, logout e recuperação de senha funcionam, em pt-BR
- [ ] Tema claro e escuro seguem a paleta das logos (`#459ac8`, `#284995`), com a logo do ONDA e a da igreja no rodapé
- [ ] Deploy automático a partir do GitHub funciona
- [ ] Existe um teste passando em cada ponto de teste: módulo de domínio e políticas por linha no Postgres local
- [ ] Pasta de documentação do projeto (`CONTEXT.md`, ADRs) preservada
