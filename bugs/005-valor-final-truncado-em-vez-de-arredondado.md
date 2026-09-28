# [005] Valor final é truncado em vez de arredondado, e o cliente paga centavos a menos

**Severidade:** Média
**Versão afetada:** v2
**Ambiente:** v2 em `http://localhost:3002` (RC), comparada com a v1 em `http://localhost:3001` (PROD), usando a carga inicial

**Resumo:** a v2 corta as casas decimais em vez de arredondar, e faz isso duas vezes: depois de aplicar o desconto e no valor final. Em parte das cotações, o valor sai 1 ou 2 centavos abaixo do correto, inclusive num dos exemplos do README. 
O total é pequeno, mas o erro é sistemático e sempre para o mesmo lado.

## Passos para reproduzir

1. Criar, na v1 e na v2, a cotação do exemplo do README de 150 kg, SP → MG, com 1 volume:
   ```bash
   curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
     -d '{"cliente":"Teste QA","peso_kg":150,"volumes":1,"uf_origem":"SP","uf_destino":"MG"}'
   ```
2. Repetir na v2 com 30 kg, SP → MG, 15 volumes.
3. Repetir na v2 com 5 kg, SP → BA, 15 volumes.

## Resultado esperado

- **README, "Valor final":** o valor é apresentado "com duas casas decimais, arredondado pela regra comercial (a partir de cinco milésimos, arredonda para cima)".
- **README, exemplos conferidos com o comercial:** 150 kg SP → MG = R$ 282,24.
- **SPEC, seção 2:** o desconto incide "sobre o valor final da cotação, já acrescido do imposto".

## Resultado obtido

| Caso | Conta exata | Esperado | v1 | v2 |
|---|---|---|---|---|
| 150 kg, SP → MG, 1 volume | 180 × 1,4 × 1,12 = 282,24 | 282,24 | 282,24 | 282,22 |
| 30 kg, SP → MG, 15 volumes | 94,08 × 0,95 = 89,376 | 89,38 | sem desconto | 89,37 |
| 5 kg, SP → BA, 15 volumes | 53,20 × 0,95 = 50,54 | 50,54 | sem desconto | 50,53 |

Cada caso mostra um efeito diferente do truncamento:
- **150 kg:** 180 × 1,4 dá 251,99999999999997. Arredondando, o resultado volta a 282,24, como na v1. Truncando, os centavos se perdem.
- **30 kg:** 89,376 deveria arredondar para cima. Truncado, vira 89,37.
- **5 kg:** o valor certo já tem duas casas, e mesmo assim a v2 perde 1 centavo, porque aplica o desconto antes do imposto e trunca no meio da conta. 25 × 1,9 = 47,50; × 0,95 = 45,125, truncado para 45,12; × 1,12 = 50,5344, truncado para 50,53.

## Causa Provável

Em [src/pricing/v2.js:31-38](../src/pricing/v2.js#L31-L38), o valor é truncado duas vezes, e o desconto é aplicado antes do imposto:

```js
const comDesconto = Math.trunc(valorRota * (1 - desconto) * 100) / 100;
const comImposto = comDesconto * (1 + IMPOSTO);
// ...
valor_total: Math.trunc(comImposto * 100) / 100,
```

A v1 arredonda uma vez só, no fim, com `Math.round` ([src/pricing/v1.js:26](../src/pricing/v1.js#L26)). O truncamento final entrou no commit `0face53` ("feat: motor de precificacao da versao 2"), e o truncamento intermediário, no `1bf4b30` ("feat: desconto por volume conforme especificacao comercial").

A correção é calcular rota × 1,12 × (1 − desconto) e arredondar uma única vez, no fim, como a v1 faz.

## Impacto

- **87 das 200 cotações da carga** saem com valor menor na v2: 55 perdem 1 centavo e 32 perdem 2.
- São **R$ 1,19** cobrados a menos no total
- A severidade é Média: o valor na carga é pequeno, mas o erro é sistemático (atinge 87 das 200 cotações) e quebra um exemplo conferido com o comercial.

Para calcular o impacto financeiro, gerei um script simples:

Antes de executar, resete a base.

```bash
node scripts/impacto_005.js
```

Como o script conta: para cada cotação, recalcula o valor pela regra do README com a base, o multiplicador e o desconto que a própria v2 aplicou, e compara com o valor que a v2 devolve. Assim, a diferença é só do arredondamento e não mistura os bugs 001 e 003.

## Evidência

Cotações criadas na v2:

<pre>
150 kg: {"id":201,"cliente":"Teste QA","peso_kg":150,"volumes":1,"uf_origem":"SP","uf_destino":"MG","faturada":false,"criada_em":"2026-09-28","valor_base":180,"multiplicador":1.4,"desconto":0,<b>"valor_total":282.22</b>}
30 kg:  {"id":202,"cliente":"Teste QA","peso_kg":30,"volumes":15,"uf_origem":"SP","uf_destino":"MG","faturada":false,"criada_em":"2026-09-28","valor_base":60,"multiplicador":1.4,"desconto":0.05,<b>"valor_total":89.37</b>}
5 kg:   {"id":203,"cliente":"Teste QA","peso_kg":5,"volumes":15,"uf_origem":"SP","uf_destino":"BA","faturada":false,"criada_em":"2026-09-28","valor_base":25,"multiplicador":1.9,"desconto":0.05,<b>"valor_total":50.53</b>}
</pre>

Na suíte de regressão, o truncamento derruba estes testes da v2:
- [regressao/tests/arredondamento.test.js](../regressao/tests/arredondamento.test.js): "30 kg, SP → MG, 15 volumes: 89,376 arredonda para R$ 89.38".
- [regressao/tests/preco-vigente.test.js](../regressao/tests/preco-vigente.test.js): o exemplo do README de 150 kg SP → MG e a combinação de 150 kg SP → MG.
- [regressao/tests/desconto.test.js](../regressao/tests/desconto.test.js): 15 das 36 combinações de faixa × rota × desconto, com o desconto correto e o valor 1 ou 2 centavos abaixo.
