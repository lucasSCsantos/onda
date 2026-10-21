# 01: Esqueleto: app instalável com login

**What to build:** o app mais fino possível, de ponta a ponta: uma pessoa abre o Mural ONDA no celular, instala na tela inicial, entra com e-mail e senha, sai e recupera a senha. Inclui a base técnica que o resto depende: projeto Next.js (TypeScript) como PWA, Supabase local, deploy automático do GitHub, identidade visual do ONDA (azuis das logos, modo claro e escuro, pt-BR, logo da igreja no rodapé) e os dois pontos de teste da spec (módulo de domínio em TypeScript puro e políticas por linha contra um Postgres local), cada um com um teste de exemplo passando.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] O app instala como PWA no celular, com ícone e tela de abertura do ONDA
- [x] Login, logout e recuperação de senha funcionam, em pt-BR
- [x] Tema claro e escuro seguem a paleta das logos (`#459ac8`, `#284995`), com a logo do ONDA e a da igreja no rodapé
- [ ] Deploy automático a partir do GitHub funciona
- [x] Existe um teste passando em cada ponto de teste: módulo de domínio e políticas por linha no Postgres local
- [x] Pasta de documentação do projeto (`CONTEXT.md`, ADRs) preservada

## Comments

**2026-10-21 (implementação, branch `feat/01-esqueleto-app-instalavel`):** tudo pronto e verificado localmente (login, sair, recuperar senha via Mailpit, modo claro e escuro, manifesto e ícones, 4 testes nos dois pontos de teste, `next build`). Falta só o deploy automático: exige criar o projeto no Supabase e na Vercel e ligar o repositório, passos que só uma pessoa pode fazer. Ao configurar, incluir a URL de produção em `additional_redirect_urls` do Supabase. A instalação no celular real também ainda não foi testada.
