# [006] Cotação já faturada é recalculada pela regra da v2 e muda de valor

**Severidade:** Alta
**Versão afetada:** v2
**Ambiente:** v2 em `http://localhost:3002` (RC), comparada com a v1 em `http://localhost:3001` (PROD), usando a carga inicial

**Resumo:** a SPEC diz que a política de desconto não é retroativa e que cotações já faturadas mantêm o valor pelo qual foram faturadas. 
A v2 recalcula todas as cotações pela regra nova, inclusive as faturadas, e 29 das 60 passam a mostrar um valor diferente do que foi cobrado. 
Não há cobrança dupla, porque o faturamento repetido é recusado com `409`, mas a tela e a API passam a mostrar um valor que não é o da fatura.

## Passos para reproduzir

1. Consultar a cotação 12 da carga inicial (40,6 kg, SP → MG, 13 volumes, já faturada) nas duas versões:
   ```bash
   curl -s http://localhost:3001/api/cotacoes/12
   curl -s http://localhost:3002/api/cotacoes/12
   ```
   Ou pela tela, selecionando a cotação 12 na listagem de cada versão.
2. Repetir com a cotação 30 (100 kg, SP → MG, 8 volumes, já faturada).

## Resultado esperado

- **SPEC, seção 5:** "A política não é retroativa. Cotações já faturadas mantêm o valor pelo qual foram faturadas; não há recálculo nem nota de ajuste."
- **README, `GET /api/cotacoes/{id}`:** o exemplo de detalhe é a própria cotação 12, faturada, com `valor_total` de 94,08.

## Resultado obtido

| Cotação faturada | v1 | v2 | O que mudou na v2 |
|---|---|---|---|
| 12 (40,6 kg, SP → MG, 13 volumes) | 94,08 | 89,37 | recebeu 5% de desconto depois de faturada |
| 30 (100 kg, SP → MG, 8 volumes) | 172,48 | 282,22 | passou para a faixa de peso seguinte (bug 001) |

A v2 aplica às cotações faturadas tudo o que mudou no cálculo: o desconto novo e também os bugs de preço (001, 003 e 005).

## Causa Provável

Nenhuma das versões guarda o valor da cotação: o preço é calculado de novo a cada consulta, com o motor da versão que está respondendo ([src/cotacoes.js:3-5](../src/cotacoes.js#L3-L5)):

```js
function comValores(cotacao, motor) {
  return { ...cotacao, ...motor.precificar(cotacao) };
}
```

Na v1 isso não aparece, porque a regra de preço nunca mudou. Na v2, o motor novo passa a valer para todas as cotações, e nada separa as já faturadas. 
O valor cobrado também não pode ser recuperado das faturas da carga, que não têm o campo `valor` (ver ESTRATEGIA, "Ambiente e dados").

A correção é exibir, para cotações faturadas, o valor gravado na fatura no momento da emissão, em vez de recalcular. As faturas emitidas pela API já gravam esse valor. As faturas da carga precisam ter o valor preenchido.

## Impacto

- **29 das 60 cotações faturadas da carga** mostram na v2 um valor diferente do que tinham na v1.
- Não há cobrança dupla, porque o faturamento repetido é recusado com `409`.
- A severidade é Alta porque descumpre uma restrição explícita da SPEC e exibe valor divergente do cobrado.

A contagem sai da suíte de regressão, que compara o detalhe de cada cotação faturada nas duas versões:

```bash
cd regressao
npx jest tests/retroatividade.test.js
```

## Evidência

Cotação 12, faturada:

<pre>
v1: {"id":12,"cliente":"Comercial Aurora","peso_kg":40.6,"volumes":13,"uf_origem":"SP","uf_destino":"MG",<b>"faturada":true</b>,"criada_em":"2026-06-13","valor_base":60,"multiplicador":1.4,"desconto":0,<b>"valor_total":94.08</b>}
v2: {"id":12,"cliente":"Comercial Aurora","peso_kg":40.6,"volumes":13,"uf_origem":"SP","uf_destino":"MG",<b>"faturada":true</b>,"criada_em":"2026-06-13","valor_base":60,"multiplicador":1.4,<b>"desconto":0.05</b>,<b>"valor_total":89.37</b>}
</pre>

Cotação 30, faturada:

<pre>
v1: {"id":30,"cliente":"Comercial Aurora","peso_kg":100,"volumes":8,"uf_origem":"SP","uf_destino":"MG",<b>"faturada":true</b>,"criada_em":"2026-06-03",<b>"valor_base":110</b>,"multiplicador":1.4,"desconto":0,<b>"valor_total":172.48</b>}
v2: {"id":30,"cliente":"Comercial Aurora","peso_kg":100,"volumes":8,"uf_origem":"SP","uf_destino":"MG",<b>"faturada":true</b>,"criada_em":"2026-06-03",<b>"valor_base":180</b>,"multiplicador":1.4,"desconto":0,<b>"valor_total":282.22</b>}
</pre>

Na suíte de regressão, o teste "as 60 cotações já faturadas mantêm na v2 o mesmo valor da v1" ([regressao/tests/retroatividade.test.js](../regressao/tests/retroatividade.test.js)) falha: 29 cotações mudam de valor, quando o esperado era nenhuma.
