# Mural ONDA

Calendário de Eventos da Liderança do ONDA, ministério de adolescentes. Next.js + Supabase. Os comandos de desenvolvimento
e as convenções estão em `CLAUDE.md`; o vocabulário, em `CONTEXT.md`; as decisões, em `docs/adr/`.

## Variáveis de ambiente

Modelo em `.env.example`. No Supabase local, copie `API_URL`, `ANON_KEY` e `SERVICE_ROLE_KEY` de
`pnpm exec supabase status -o env`.

| Variável | Onde vale | Para quê |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | navegador e servidor | endereço do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador e servidor | chave pública (anon); as políticas por linha protegem os dados |
| `SUPABASE_SERVICE_ROLE_KEY` | **só o servidor** | chave service-role, que ignora as políticas por linha. Usada apenas pelo feed do calendário (`/feed/<token>.ics`). Nunca use o prefixo `NEXT_PUBLIC_` nela, nem a coloque em código que roda no navegador |
| `FEED_LIMITE_POR_HORA` | servidor, opcional | consultas por hora que cada endereço de calendário aceita (padrão 60) |

Em produção (Vercel), cadastre `SUPABASE_SERVICE_ROLE_KEY` como variável de ambiente do projeto, só para o servidor; a chave
`service_role` fica no painel do Supabase, em Project Settings → API.

## Assinatura de calendário

Cada pessoa aprovada gera o próprio endereço `.ics` em **Minha conta → Calendário** (`/conta`) e assina no calendário do
celular. O endereço funciona como senha de leitura:

- o token tem 256 bits aleatórios e é mostrado uma única vez; o banco guarda só o hash (SHA-256);
- regerar invalida o endereço anterior; revogar apaga a assinatura;
- cada token aceita 60 consultas por hora; acima disso, a rota responde 429 com `Retry-After`;
- endereço desconhecido, regerado ou revogado responde 404, sem distinguir um do outro;
- gerar, regerar e revogar viram Log; o token e o endereço nunca são registrados.

A geração do texto é a função pura `gerarFeed` (`src/dominio/assinatura-de-calendario.ts`); a rota só busca os dados.
