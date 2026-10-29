# Validação: fila de pagamento de fornecedores de prefeitura (22/10/2026)

## O que foi medido

- **Fonte:** a ordem cronológica de pagamentos (Lei 14.133, art. 141) de **22 prefeituras** que usam o portal da Elotech (20 no Paraná e 2 em Rondônia), mais a fila atual de notas liquidadas e ainda não pagas.
- **Período:** pagamentos de 2026 até 21/10.
- **Volume:** 86.443 pagamentos (R$ 1,82 bilhão) e 4.308 notas na fila.
- **Porte:** consultado na BrasilAPI (dados da Receita) numa amostra aleatória de 400 dos 3.866 CNPJs credores.

## Resultados

| Pergunta | Resposta |
|---|---|
| Atraso médio | Da liquidação ao pagamento: mediana de **4 dias**, média de 5,4, 90% em até 11 dias. Só **1,2%** saíram com mais de 30 dias |
| Pagamentos fora da ordem | **3,7%** das notas de 2026 foram passadas para trás por 7 dias ou mais. Mesmo essas esperaram pouco: mediana de 14 dias, 90% em até 39 dias |
| Fila parada agora | 4.308 notas (R$ 48 milhões), espera mediana de 3 dias; só 158 com mais de 60 dias |
| Quantos credores são pequenas empresas | **73,0% ± 4,4 p.p.** (micro 41%, pequeno porte 24%, MEI 8%) |

A medida bruta de "furaram a fila" deu 19,5%, mas estava inflada. Uma única nota travada faz todas as posteriores contarem como "furou", e 12.150 pagamentos eram de restos a pagar de 2025. A medida que vale é a das notas passadas para trás, só do exercício de 2026.

## Conclusão

**O público existe, a dor medida não.** Quase 3 em cada 4 credores são pequenas empresas, mas, depois da liquidação, estas prefeituras pagam em poucos dias e quase sempre na ordem. Um produto que só vigie a fila resolveria um problema que, nesta amostra, quase não existe.

## Limites (o que os dados não mostram)

1. **A espera antes da liquidação é invisível.** A fila oficial só começa quando a prefeitura liquida (atesta) a nota. Se ela segura a nota fiscal semanas antes de atestar, essa espera não aparece em lugar nenhum. É o lugar mais provável de a dor estar escondida.
2. **A amostra é favorável.** São prefeituras do Paraná, um estado com contas organizadas, que usam um portal moderno. Estados e municípios em crise fiscal podem ser bem diferentes, mas usam outros portais e exigiriam outros raspadores.
3. **Publicação incompleta.** Marialva (44 pagamentos no ano), Engenheiro Beltrão (40) e Rolim de Moura (218) publicam pouco demais. Isso é indício de descumprimento do §3º, mas também mostra que nem todo município entrega o dado.
4. **O vencimento quase nunca vem preenchido**, por isso o atraso foi medido da liquidação ao pagamento.

## Arquivos

- `raspar.mjs`: baixa a ordem cronológica e os aptos a pagamento (API pública do portal, uma requisição por vez).
- `analisar.mjs`: prazo de pagamento, quebras de ordem e fila; gera `analise.txt`, `resumo.json` e `credores.json`.
- `porte.mjs`: porte dos credores por amostra, na BrasilAPI.
- `cidades.txt`: as 22 prefeituras (subdomínio e entidade).
- `dados/`: os dados brutos. Não estão no repositório (61 MB); o `raspar.mjs` baixa de novo.
- `analise.txt` e `resumo.json`: os resultados agregados por cidade.
