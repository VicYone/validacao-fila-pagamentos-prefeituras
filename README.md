# Validação de ideia de produto com dados públicos

Antes de escrever uma linha de produto, medi se a dor existia. A ideia era um serviço para pequenos fornecedores acompanharem a **fila de pagamento das prefeituras**. Em um dia, raspei os portais de transparência de **22 prefeituras** (86.443 pagamentos, R$ 1,82 bilhão) e cruzei com o porte dos credores. **O público existe, a dor não**, e a ideia foi descartada sem custo de desenvolvimento.

## A hipótese

A Lei 14.133/2021 (art. 141) obriga as prefeituras a pagar fornecedores na ordem cronológica e a publicar essa fila. Se elas atrasassem ou furassem a fila com frequência, pequenas empresas pagariam para ser avisadas.

## O que os dados mostraram

| Pergunta | Resposta |
|---|---|
| Quantos credores são pequenas empresas? | **73% ± 4,4 p.p.** (micro, pequeno porte e MEI) |
| Quanto demora da liquidação ao pagamento? | Mediana de **4 dias**. Só **1,2%** passam de 30 dias |
| Quantos pagamentos furam a fila? | **3,7%** das notas foram passadas para trás por 7 dias ou mais |

O relatório completo, com os limites da análise, está em [`RESULTADO.md`](RESULTADO.md).

Um cuidado que mudou a conclusão: a medida bruta de "furaram a fila" dava **19,5%**. Estava inflada, porque uma única nota travada faz todas as seguintes contarem como fura-fila, e porque 12 mil pagamentos eram restos a pagar do ano anterior. A medida certa (notas passadas para trás, só do exercício corrente) deu 3,7%.

## Como funciona

| Script | O que faz |
|---|---|
| `raspar.mjs` | Baixa da API pública do portal (Elotech) a ordem cronológica de pagamentos e a fila atual de cada prefeitura, uma requisição por vez e com pausa |
| `analisar.mjs` | Calcula prazo de pagamento, quebras de ordem e fila parada por cidade; gera `analise.txt` e `resumo.json` |
| `porte.mjs` | Sorteia 400 CNPJs credores (amostra com semente fixa, reproduzível) e consulta o porte na BrasilAPI |
| `cidades.txt` | As 22 prefeituras: subdomínio, entidade, nome e UF |

## Como rodar

Requer Node.js 20.11 ou mais novo. Não há dependências.

```bash
node raspar.mjs cidades.txt 2026
node analisar.mjs
node porte.mjs 400
```

Os dados brutos (`dados/`) e a lista de credores (`credores.json`, com nomes e documentos) ficam fora do repositório: são grandes e trazem dados de pessoas físicas que não precisam circular. Os resultados agregados estão em `analise.txt` e `resumo.json`.

Feito com Node.js e Claude Code.
