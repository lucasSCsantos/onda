# 02: Datas e horas (seletor de data, de intervalo e de hora)

**What to build:** a Liderança escolhe datas e horas em um calendário e um seletor de hora próprios, em pt-BR, em vez dos controles nativos do navegador, em todas as telas, sem mudar o que cada formulário envia. Sem dependência nova.

- **Seletor de data:** popover no desktop e painel inferior no celular; meses e dias em português, semana começando na **segunda-feira** (igual ao calendário principal; a diferença em relação ao domingo padrão fica registrada no resumo), hoje destacado, dia selecionado em evidência, dias de fora do mês esmaecidos, navegação de mês e ano (para chegar a datas de nascimento antigas) e atalho "Hoje".
- **Intervalo:** a variante de intervalo (início e fim em um calendário), usada nos filtros de período (Logs, filtros de Eventos).
- **Hora:** passos de 5 ou 15 minutos, campo digitável e a opção "sem horário" (dia inteiro), sem mudar a regra atual de que hora vazia significa dia inteiro. A variante com data e hora vale para os campos específicos de Categoria do tipo data e hora. O select de hora da janela de notificações também usa o novo seletor.
- A lógica sem interface (grade do mês em pt-BR com semana na segunda, regras de intervalo, leitura e arredondamento de hora, tratamento de campo vazio) fica em módulo de domínio de TS puro, testado sem navegador.
- Substitui todos os `type="date"`, `type="time"` e `type="datetime-local"` (Evento e fim, repetição e Série, nascimento no cadastro e em Adolescentes, filtros de Eventos, Logs, campos específicos de Categoria, preferências de notificação).
- **Calendário principal (Lista, Mês, Semana):** só estilo (tipografia, cores e bordas coerentes com os novos componentes). Nenhuma lógica de navegação, de períodos ou de Eventos é alterada.
- Todos os estados (padrão, hover, foco, desabilitado, erro, carregando), teclado completo, acessibilidade, 44 px de área de toque, tokens e tema claro e escuro.
- **Fechamento da Alteração 1:** auditoria final de que não sobrou nenhum controle nativo (ou cada exceção listada com o motivo), capturas antes e depois das telas principais em 375 px e em desktop, README atualizado e resumo da alteração (o que foi feito, decisões, suposições, limitações, como testar à mão e como reverter).
- Trabalha na mesma branch `feat/alt-1-componentes`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Nenhum `date`, `time` ou `datetime-local` nativo restou no app, exceto os mantidos de propósito e listados com o motivo
- [ ] Os formulários enviam os mesmos campos e formatos de antes; hora em branco continua sendo dia inteiro
- [ ] Testes de domínio da grade pt-BR com semana na segunda, dias de fora do mês, seleção de data e de intervalo, passos e leitura de hora (inclusive vazio)
- [ ] Testes de fumaça: teclado (setas, Enter, Esc, Tab), abertura e fechamento, escolha de data e de intervalo, valor enviado no formulário e atributos de acessibilidade
- [ ] Campo de data de nascimento permite chegar a anos antigos sem rolar mês a mês
- [ ] Calendário principal com estilo coerente e nenhuma mudança de comportamento (testes e fumaça existentes continuam passando)
- [ ] Capturas antes e depois em 375 px e em desktop e resumo da Alteração 1 entregues
- [ ] Linha de base comparada: `pnpm test`, `pnpm typecheck`, `pnpm lint` e o build verdes
