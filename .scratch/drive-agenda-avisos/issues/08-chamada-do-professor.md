# 08: Chamada do Professor

**Spec:** `../spec.md` (Alteração 5.2, permissão no banco)

**What to build:** O Professor e o Auxiliar de uma aula (ligados pelos campos "Professor" e "Auxiliar" do Evento) fazem e corrigem a Chamada daquela aula a partir do dia dela, mesmo sem Função na Área de Ensino. Para isso veem, na Chamada, só nome e identificador dos Adolescentes ativos, nunca a data de nascimento. A tabela de Adolescentes continua restrita à Liderança.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A função do banco que decide quem pode fazer a Chamada passa a incluir o Professor e o Auxiliar daquela aula, a partir do dia dela
- [ ] Uma função `security definer` devolve ao Professor apenas nome e identificador dos Adolescentes ativos daquela Chamada, sem nascimento e sem acesso à tabela de Adolescentes
- [ ] Salvar e corrigir a Chamada respeita a mesma regra; o Professor não faz Chamada de outra aula nem antes do dia
- [ ] Um Professor de nível Professor continua sem ver Adolescentes, aniversários e Ranking fora da Chamada da própria aula
- [ ] A tela da Chamada funciona para o Professor e o Auxiliar; Chamada feita ou corrigida vira Log
- [ ] Glossário (Chamada, Professor) coerente com o comportamento
- [ ] Testes do banco (permitido na aula própria, negado em outra aula e antes do dia, sem nascimento, negado a outros níveis) e fumaça da Chamada por um Professor
