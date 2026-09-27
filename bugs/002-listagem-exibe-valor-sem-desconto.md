# [002] Listagem exibe o valor sem desconto, diferente do detalhe e da fatura

**Severidade:** Alta
**Versão afetada:** v2
**Ambiente:** v2 em `http://localhost:3002` (RC), comparada com a v1 em `http://localhost:3001` (PROD), usando a carga inicial

**Resumo:** na v2, a listagem de cotações mostra o valor **sem** o desconto por volume, enquanto o detalhe e a fatura usam o valor **com** desconto. 
Além disso, o campo `valor_total` da listagem passou a se chamar `total`, o que quebra o contrato do README para qualquer sistema que consuma a API.

## Passos para reproduzir

1. Consultar a cotação 61 (62,3 kg, RJ → PR, 16 volumes, em aberto) na listagem e no detalhe da v2:
   ```bash
   curl -s "http://localhost:3002/api/cotacoes?page=61&limit=1"
   curl -s http://localhost:3002/api/cotacoes/61
   ```
2. Repetir o passo 1 na v1, trocando a porta para 3001.
3. Faturar a cotação 61 na v2 e comparar o valor da fatura com o da listagem:
   ```bash
   curl -s -X POST http://localhost:3002/api/cotacoes/61/faturar
   ```
4. Na tela da v2, comparar a coluna Total da tabela com o Total do detalhe da cotação 61.

## Resultado esperado

- **README, `GET /api/cotacoes`:** cada item da listagem traz o campo `valor_total`. 
Em `GET /api/cotacoes/{id}`: "O campo `valor_total` é o mesmo apresentado na listagem para a mesma cotação."
- **SPEC, critério de aceite 6:** "O valor final apresentado ao cliente é o valor com imposto e com desconto."
- **CHANGELOG, "Ajustes de performance na listagem":** promete um payload "mais enxuto", com "apenas o que a tabela da tela precisa exibir". Não declara troca de nome de campo nem mudança no valor.

## Resultado obtido

| Cotação 61 | v1 | v2 |
|---|---|---|
| Campo de valor no item da listagem | `valor_total` | `total` |
| Valor na listagem | R$ 234,08 | R$ 234,08 |
| Valor no detalhe | R$ 234,08 | R$ 222,37 (desconto de 5%) |

Na v2, a listagem mostra o valor sem desconto, e o detalhe mostra o valor com desconto (correto). 
A fatura sai pelo valor do detalhe.

Outros pontos observados:
- O payload não ficou mais enxuto. 
   Os itens têm os mesmos 8 campos nas duas versões, a v2 apenas deixou o nome de um campo mais curto. 
   O CHANGELOG diz que "antes cada item carregava a estrutura completa da cotação", mas na v1 o item já trazia só esses 8 campos.
- Na tela, a tabela mostra o valor sem desconto e o detalhe mostra o valor com desconto. A tela foi adaptada para ler `total` quando não encontra `valor_total` ([public/app.js:13-15](../public/app.js#L13-L15)), por isso a troca de nome não aparece nela. 
A coluna Desconto da tabela mostra "—" em todas as linhas, porque o item da listagem não traz o campo `desconto`.

## Causa

Em [src/cotacoes.js:14-21](../src/cotacoes.js#L14-L21), o item da listagem da v2 é montado com o campo `total`, e o valor é calculado com `volumes: 1`, o que zera o desconto:

```js
const semDesconto = motor.precificar({ ...cotacao, volumes: 1 });
// ...
faturada: cotacao.faturada, total: semDesconto.valor_total,
```

A alteração entrou no commit `dd79159` ("feat: payload resumido na listagem de cotacoes").
A correção é voltar a devolver `valor_total` com o resultado de `motor.precificar(cotacao)`, que já é calculado na linha 13 e hoje não é usado pela v2.

## Impacto

- **Contrato quebrado nos 200 itens da listagem:** nenhum traz `valor_total`. Qualquer sistema que leia a listagem pelo contrato do README recebe o valor vazio.
- **95 das 200 cotações** (todas as que têm desconto) aparecem na listagem com um valor maior que o do detalhe.
- Não gera cobrança errada, porque a fatura sai pelo valor do detalhe. A severidade é Alta pois exibe valores divergentes em tela.

## Evidência

Cotação 61 na v2:

<pre>
listagem: {"id":61,"cliente":"Metalúrgica Vale","peso_kg":62.3,"volumes":16,"uf_origem":"RJ","uf_destino":"PR","faturada":false,<b>"total":234.08</b>}
detalhe:  {"id":61,"cliente":"Metalúrgica Vale","peso_kg":62.3,"volumes":16,"uf_origem":"RJ","uf_destino":"PR","faturada":false,"criada_em":"2026-06-06","valor_base":110,"multiplicador":1.9,<b>"desconto":0.05</b>,<b>"valor_total":222.37</b>}
fatura:   {"id":61,"id_cotacao":61,"cliente":"Metalúrgica Vale",<b>"valor":222.37</b>,"emitida_em":"2026-09-27"}
</pre>


Cotação 61 na listagem da v1:

<pre>
{"total":200,"itens":[{"id":61,"cliente":"Metalúrgica Vale","peso_kg":62.3,"volumes":16,"uf_origem":"RJ","uf_destino":"PR","faturada":false,<b>"valor_total":234.08</b>}]}
</pre>

