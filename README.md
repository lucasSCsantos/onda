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

## Notificações push

Em "Minha conta", cada pessoa da Liderança (e Professor) ativa as Notificações **neste aparelho**, só depois de tocar em "Ativar":
o navegador pede a permissão nesse momento e nunca antes. No iPhone e no iPad o app precisa estar na Tela de Início
(Compartilhar → Adicionar à Tela de Início). Cada aparelho tem a própria inscrição na tabela `inscricoes_de_push`; o endpoint e
as chaves só o servidor lê (nunca a interface, os Logs ou as exportações). Sair da conta remove a inscrição daquele aparelho.
O botão "Enviar notificação de teste" manda um aviso só para si mesmo.

| Variável | Onde | O que é |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | navegador e servidor | chave pública VAPID |
| `VAPID_PRIVATE_KEY` | **só o servidor** | chave privada VAPID |
| `VAPID_SUBJECT` | servidor | contato, no formato `mailto:alguem@exemplo.com.br` |
| `PUSH_MODO_TESTE` | servidor | `1` = dry-run: o envio só finge que deu certo |

**Gerar as chaves:** `scripts/wizard-integracoes.sh` (etapa 9) gera o par e mostra os valores, ou, à mão:

```
node -e 'const c=require("crypto");const k=c.generateKeyPairSync("ec",{namedCurve:"prime256v1"});const p=k.publicKey.export({format:"jwk"});console.log("pública:",Buffer.concat([Buffer.from([4]),Buffer.from(p.x,"base64url"),Buffer.from(p.y,"base64url")]).toString("base64url"));console.log("privada:",k.privateKey.export({format:"jwk"}).d)'
```

**Rotacionar:** gere um par novo e troque as três variáveis (na Vercel e no `.env.local`). Um par novo **invalida todas as
inscrições existentes**: cada pessoa precisa desativar e ativar de novo em "Minha conta". Só rotacione se a chave privada vazou.
A chave privada nunca vai em código, em Log nem no navegador.
