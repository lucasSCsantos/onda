## Agent skills

### Issue tracker

Issues and specs are local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Desenvolvimento

- Next.js 16 com mudanças grandes em relação a versões antigas (por exemplo, `middleware` virou `proxy`). Antes de escrever código de Next, leia o guia correspondente em `node_modules/next/dist/docs/`.
- Supabase local roda no Docker em portas `553xx` (a faixa padrão `543xx` está ocupada nesta máquina): `pnpm exec supabase start`. Copie `API_URL` e `ANON_KEY` de `pnpm exec supabase status -o env` para `.env.local` (modelo em `.env.example`). E-mails locais chegam no Mailpit, em `http://127.0.0.1:55324`.
- Comandos: `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test:dominio` (módulo de domínio, sem banco), `pnpm test:rls` (políticas por linha, exige o Supabase local), `pnpm test` (tudo, menos a fumaça), `pnpm test:fumaca` (Playwright em `tests/fumaca/`, celular simulado; exige o Supabase local e faz `next build`; `PLAYWRIGHT_CHANNEL=chrome` usa o Chrome instalado).
- Pontos de teste: o módulo de domínio em `src/dominio/` (TypeScript puro) e as políticas por linha em `tests/rls/`. A interface fica fina, sem regra de negócio própria.
- Logos: as fontes ficam em `assets/`; `pnpm gerar:marcas` regenera os ícones do PWA e os SVGs usados nos componentes.
