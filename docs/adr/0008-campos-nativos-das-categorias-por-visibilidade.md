# Campos nativos do Evento são mostrados ou ocultados por Categoria, sem migrar dados

Local, fim, observações e link continuam colunas de todo Evento. Cada Categoria passa a ter uma configuração (editável pelo Admin, inclusive ao criar a Categoria) que diz se cada um desses campos fica oculto, visível ou obrigatório. A alternativa, mover esses valores para os campos por Categoria (ADR 0002), exigiria migrar dados reais; a escolha mantém os dados antigos intactos, só escondidos na interface.
