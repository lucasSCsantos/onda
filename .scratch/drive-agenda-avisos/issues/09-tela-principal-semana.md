# 09: Tela principal: semana

**Spec:** `../spec.md` (Alteração 5.1)

**What to build:** A tela principal abre com "Meus eventos desta semana" (Eventos em que a pessoa é Responsável e aulas em que é Professor ou Auxiliar), seguido de alertas (sem Responsável, Rascunho), "Esta semana no ONDA" com a opção "só os meus", "Próximos eventos" reduzido ao grupo "Depois" e os aniversariantes. Reaproveita os filtros, a semana e os alertas que já existem.

**Blocked by:** 03 (Séries semanais com número, para o título de exibição)

**Status:** done

- [ ] "Meus eventos desta semana" em ordem cronológica, com o dia de hoje destacado e Categoria (cor e ícone), horário, local (quando existir) e Status em cada cartão
- [ ] "Esta semana no ONDA" mostra todos os Eventos da semana, com a opção "só os meus"
- [ ] Alertas de Eventos da semana sem Responsável e em Rascunho, com atalho para corrigir
- [ ] Aniversariantes da semana para a Liderança
- [ ] "Próximos eventos" passa a mostrar só o grupo "Depois"; nenhum Evento aparece duas vezes
- [ ] Estados vazios claros ("Você não tem eventos nesta semana") e rolagem enxuta no celular
- [ ] O Professor de nível Professor continua vendo só "Suas aulas"
- [ ] A semana segue a definição do atalho "Esta semana" existente, sem consultas duplicadas
- [ ] Testes de domínio (montagem das listas, "só os meus", grupo "Depois", estados vazios) e fumaça dos cartões
