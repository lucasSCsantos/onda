# Campos das Categorias são dados de configuração, não colunas

Os campos específicos de cada Categoria (tema, professor, valor, checklist etc.) são definidos como dados editáveis pelo Admin, com um conjunto fechado de tipos (texto curto, texto longo, link, valor em reais, data, data e hora, escolha de uma opção, lista de itens, pessoa, checklist). Isso permite criar uma Categoria nova sem mudar a estrutura do banco, ao custo de consultas e validações menos diretas do que colunas fixas.
