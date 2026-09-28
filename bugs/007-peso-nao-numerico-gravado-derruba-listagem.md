# [007] Peso e volumes não numéricos passam pela validação, e o peso inválido derruba a listagem da tela

**Severidade:** Média
**Versão afetada:** ambas
**Ambiente:** v2 em `http://localhost:3002` (RC) e v1 em `http://localhost:3001` (PROD), usando a carga inicial

**Resumo:** uma cotação criada pela API com peso não numérico passa pela validação, responde `500` e fica gravada. 
A partir daí, qualquer consulta que precise calcular o preço dela falha, inclusive a listagem que a tela de operação carrega. 
Uma única chamada inválida deixa a tabela da tela sem cotações para todos os usuários, até o serviço ser reiniciado. 
Com volumes não numérico, a cotação é aceita com `201` e gravada sem o número de volumes.

## Passos para reproduzir

1. Criar uma cotação com peso `"abc"`:
   ```bash
   curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
     -d '{"cliente":"Teste QA","peso_kg":"abc","volumes":1,"uf_origem":"SP","uf_destino":"SP"}'
   ```
2. Conferir que a cotação ficou gravada (o `total` passa de 200 para 201):
   ```bash
   curl -s "http://localhost:3002/api/cotacoes?limit=1"
   ```
3. Chamar a listagem como a tela chama, com `limit=500`:
   ```bash
   curl -s "http://localhost:3002/api/cotacoes?limit=500"
   ```
4. Abrir a tela da v2 em `http://localhost:3002`.
5. Resetar a base e criar uma cotação com volumes `"abc"`:
   ```bash
   curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
     -d '{"cliente":"Teste QA","peso_kg":10,"volumes":"abc","uf_origem":"SP","uf_destino":"SP"}'
   ```
6. Repetir na v1, trocando a porta para 3001.

## Resultado esperado

- **README, `POST /api/cotacoes`:** "`peso_kg` precisa ser positivo", e o `422` "devolve `{ "erro": "..." }` descrevendo o problema de validação". 
Um texto não é um peso positivo, então a resposta esperada é `422`, sem gravar nada.
- **README, `POST /api/cotacoes`:** "`volumes` no mínimo 1".

## Resultado obtido

A criação responde `500` com `{"erro":"Erro interno"}`, mas a cotação fica gravada com o id 201. Depois disso:

| Chamada | Resposta |
|---|---|
| `GET /api/cotacoes?limit=500`, que é o que a tela usa | `500` |
| `GET /api/cotacoes?page=11`, a página em que a cotação 201 cai com o limite padrão de 20 | `500` |
| `GET /api/cotacoes?page=1` a `page=10` | `200`, normal |
| `GET /api/cotacoes/201` | `500` |
| `POST /api/cotacoes/201/faturar` | `500` |

Na tela, a tabela de cotações fica vazia, porque a listagem responde com erro.

Com volumes `"abc"`, a criação responde `201` e a cotação fica gravada com `"volumes": null`. O preço sai como se fosse um volume só, sem desconto. 
A tela continua funcionando, porque o volume não entra no cálculo da faixa de peso, mas um dado inválido fica gravado como se fosse válido.

O formulário da tela não deixa digitar texto no peso nem nos volumes (os campos são `type="number"`), então essas entradas chegam pela API, por exemplo de uma integração.

## Causa Provável

Em [src/cotacoes.js:45](../src/cotacoes.js#L45), a validação usa `Number(dados.peso_kg) <= 0`. `Number("abc")` é `NaN`, e `NaN <= 0` é falso, então o valor passa. 
Com volumes acontece o mesmo, porque `NaN < 1` também é falso:

```js
if (Number(dados.peso_kg) <= 0 || Number(dados.volumes) < 1) {
```

Em seguida, a cotação é gravada ([src/cotacoes.js:59](../src/cotacoes.js#L59)) antes de o preço ser calculado (linha 60). O motor de preço não encontra faixa de peso para `NaN` e lança um erro, que vira o `500`. Toda leitura posterior dessa cotação tenta calcular o preço de novo e falha do mesmo jeito.

A validação existe desde o commit `95b9bbc` ("feat: motor de precificacao por faixa de peso e rota"), por isso as duas versões têm o problema.

A correção é recusar com `422` qualquer peso ou volume que não seja um número válido e só gravar a cotação depois que o preço for calculado com sucesso.

## Impacto

- **Nenhuma cotação da carga tem peso inválido.** O problema começa na primeira chamada inválida à API.
- **Uma única chamada com peso não numérico derruba a tabela da tela para todos os usuários,** além do detalhe e do faturamento daquela cotação, até o serviço ser reiniciado.
- **Com volumes não numérico, a cotação é aceita** e gravada sem o número de volumes, com um preço que ignora o desconto.
- A severidade é Média porque não afeta valores cobrados e não acontece em tela, mas pode parar a operação caso feita via API.

## Evidência

Na v2, depois de criar a cotação com peso `"abc"`:

<pre>
POST /api/cotacoes:            {"erro":"Erro interno"}  <b>HTTP 500</b>
GET /api/cotacoes?limit=1:     {<b>"total":201</b>, ...}
GET /api/cotacoes?limit=500:   {"erro":"Erro interno"}  <b>HTTP 500</b>
</pre>

Na v2, a cotação com volumes `"abc"`:

<pre>
{"id":201,"cliente":"Teste QA","peso_kg":10,<b>"volumes":null</b>,"uf_origem":"SP","uf_destino":"SP","faturada":false,"criada_em":"2026-09-28","valor_base":60,"multiplicador":1,"desconto":0,"valor_total":67.2}  <b>HTTP 201</b>
</pre>

Na suíte de regressão, quatro testes de [regressao/tests/validacao.test.js](../regressao/tests/validacao.test.js) falham nas duas versões:
- "peso_kg abc responde 422": responde `500`.
- "volumes abc responde 422": responde `201`.
- "depois de uma entrada com peso não numérico, nada é gravado e a listagem da tela (limit=500) continua respondendo": a listagem responde `500`.
- "depois de uma entrada com volumes não numérico, nada é gravado e a listagem da tela (limit=500) continua respondendo": a cotação fica gravada, e o total passa a 201.
