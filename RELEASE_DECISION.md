# Decisão de release — v2

## Decisão: GO / NO-GO

**Decisão:** NO-GO

**Data da análise:** 2026-09-27

**Versões comparadas:** v1 (produção) × v2 (release candidate)

## Justificativa

**O problema que sozinho derruba o release é o [bug 001](bugs/001-peso-no-limite-cai-na-faixa-seguinte.md).** A v2 cobra pela faixa de peso seguinte toda cotação com peso exatamente no limite (10, 50 ou 100 kg). 

É uma regressão de uma regra que funciona em produção e está escrita no README ("os limites são inclusivos"). 

Na carga inicial, são 20 das 200 cotações (10%), com R\$ 2.032,87 cobrados a mais, até 140% a mais por cotação.

Além dele, a própria feature nova e as mudanças do CHANGELOG têm problemas que também impedem a subida:

- **O desconto erra nos limites da tabela** ([bug 003](bugs/003-limite-de-volume-recebe-desconto-menor.md)). Pedidos com exatamente 20 ou 50 volumes recebem o desconto da faixa de baixo.
- **Cotações já faturadas mudam de valor** ([bug 006](bugs/006-cotacao-faturada-recalculada-na-v2.md)): 29 das 60. A SPEC diz de forma explícita que não há recálculo.
- **A listagem mostra um valor que não é o cobrado** e quebra o contrato da API ([bug 002](bugs/002-listagem-exibe-valor-sem-desconto.md)): o campo `valor_total` some dos 200 itens, e 95 cotações aparecem sem o desconto.


## Resumo dos problemas encontrados

| # | Problema | Severidade | Versão | Impacto medido | Bloqueia? |
|---|---|---|---|---|---|
| [001](bugs/001-peso-no-limite-cai-na-faixa-seguinte.md) | Peso exatamente no limite é cobrado pela faixa seguinte | Crítica | v2 | 20 de 200 cotações; R\$ 2.032,87 cobrados a mais | Sim |
| [002](bugs/002-listagem-exibe-valor-sem-desconto.md) | Listagem exibe o valor sem desconto e renomeia `valor_total` | Alta | v2 | 200 de 200 itens sem `valor_total`; 95 com valor diferente do detalhe | Sim |
| [003](bugs/003-limite-de-volume-recebe-desconto-menor.md) | Pedido com exatamente 20 ou 50 volumes recebe o desconto de baixo | Alta | v2 | 7 cotações; R\$ 64,33 cobrados a mais. Nenhuma com 50 volumes na carga | Sim |
| [006](bugs/006-cotacao-faturada-recalculada-na-v2.md) | Cotação já faturada é recalculada e muda de valor | Alta | v2 | 29 de 60 cotações faturadas | Sim |
| [004](bugs/004-faturamento-simultaneo-duplica-fatura.md) | Dois pedidos simultâneos de faturamento geram fatura duplicada | Alta | ambas | Nenhuma duplicada na carga; as 140 em aberto estão expostas | Não, porque já existe na v1 |
| [005](bugs/005-valor-final-truncado-em-vez-de-arredondado.md) | Valor final truncado em vez de arredondado | Média | v2 | 87 de 200 cotações; R\$ 1,19 cobrados a menos | Não sozinho; corrigir junto com o 001 |
| [007](bugs/007-peso-nao-numerico-gravado-derruba-listagem.md) | Peso e volumes não numéricos passam pela validação | Média | ambas | Nenhuma na carga; uma chamada inválida derruba a tabela da tela | Não, porque já existe na v1 |

## Condições para liberar

Cada condição é comprovada por um arquivo da [suíte de regressão](regressao/README.md):

1. **Corrigir o bug 001** e rodar a `preco-vigente.test.js`: a v2 passa nos 23 testes, como a v1.
2. **Corrigir o arredondamento do bug 005**, comprovar com o `arredondamento.test.js` e com as 36 combinações do `desconto.test.js`.
3. **Corrigir os limites de desconto do bug 003** comprovar com o `desconto.test.js` inteiro, ajustando o esperado de 10 volumes se o PO escolher o texto em vez da tabela.
4. **Corrigir a listagem do bug 002.** Comprovar com o `contrato.test.js` na v2.
5. **Parar de recalcular cotações faturadas (bug 006).** Comprovar com o teste das faturadas do `retroatividade.test.js`: nenhuma das 60 muda de valor.
6. **Ter a resposta da pergunta 2.** Se valer o valor orçado, as 140 cotações em aberto mantêm o valor da v1, e o teste das abertas do `retroatividade.test.js` passa. 
Se valer a regra vigente na emissão, esse teste é ajustado para o novo esperado.
7. **Rodar a suíte completa:** na v2, as únicas falhas que podem restar são as dos bugs 004 e 007, que também existem na v1.

## Riscos aceitos

| Risco | Por que é aceitável | Como detectaríamos em produção |
|---|---|---|
| Fatura duplicada com pedidos simultâneos (bug 004) | Já existe na v1, a tela não reproduz e a correção é pequena. Deve ser corrigido, mas segurar a v2 não reduz esse risco | Uma consulta diária de cotações com mais de uma fatura |
| Peso ou volumes não numéricos aceitos pela API (bug 007) | Já existe na v1, e o formulário da tela não permite essa entrada | Alerta de erro `500` na listagem e na criação, e cotações gravadas sem número de volumes |
| A carga cobre só 22 das 48 combinações de faixa × rota × desconto | A suíte cria cotações novas e cobre as 48 | Acompanhar, nos primeiros dias, a distribuição dos descontos aplicados por faixa de volume |
| Tela validada só manualmente | Os valores que ela mostra vêm da API, que a suíte cobre | Teste manual em prod / Relato dos usuários |
| Performance, carga e segurança fora do escopo desta validação | A v2 não declara mudança de segurança, e performance não tem efeito financeiro | Monitorar o tempo de resposta da listagem |

## Recomendação de acompanhamento

Depois das correções e de uma nova rodada da suíte, se a v2 subir:

**O que monitorar nos primeiros dias:**
- Amostras de cotações novas conferidas contra a regra do README e da SPEC, inclusive pesos no limite de faixa e volumes no limite da tabela de desconto.
- Cotações faturadas cujo valor exibido difere do valor da fatura.
- A distribuição dos descontos aplicados (0%, 5%, 10% e 15%) comparada com a quantidade de volumes.
- Cotações com mais de uma fatura.
- Erros `500` na listagem e na criação de cotações.

**Gatilho de rollback:**
- Qualquer cotação faturada exibindo valor diferente do da fatura.
- Qualquer cotação nova com valor diferente do calculado pela regra do README e da SPEC.
- Qualquer fatura duplicada.