# [003] Pedido com exatamente 20 ou 50 volumes recebe o desconto da faixa de baixo

**Severidade:** Alta
**Versão afetada:** v2
**Ambiente:** v2 em `http://localhost:3002` (RC), usando a carga inicial

**Resumo:** na v2, os limites da tabela de desconto por volume ficaram exclusivos. Um pedido com exatamente 20 volumes recebe 5% em vez de 10%, e um com exatamente 50 volumes recebe 10% em vez de 15%. O cliente paga mais do que a política comercial define. 
Os critérios de aceite da SPEC passam, porque nenhum deles usa um valor de limite.

## Passos para reproduzir

1. Criar na v2 uma cotação com exatamente 20 volumes:
   ```bash
   curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
     -d '{"cliente":"Teste QA","peso_kg":5,"volumes":20,"uf_origem":"SP","uf_destino":"SP"}'
   ```
2. Repetir o passo 1 com 50 volumes, e com 19 e 49 volumes, para comparar o limite com o valor logo abaixo dele.
3. Consultar a cotação 65 da carga inicial (75,5 kg, BA → RJ, 20 volumes, em aberto):
   ```bash
   curl -s http://localhost:3002/api/cotacoes/65
   ```
   Ou pela tela, selecionando a cotação na listagem e conferindo o Desconto no detalhe.

## Resultado esperado

- **SPEC, tabela de desconto:** 
"10 a 19 → 5%", 
"20 a 49 → 10%" e 
"50 ou mais → 15%". 
Os limites de baixo de cada faixa (20 e 50) estão dentro dela.
- **SPEC, critérios de aceite:** 3 volumes sem desconto, 15 volumes com 5%, 30 volumes com 10% e 80 volumes com 15%.
- O caso de exatamente 10 volumes é ambíguo: a tabela diz "10 a 19 → 5%" e o texto diz que a política vale "para pedidos acima de 10 volumes". 
Está registrado na pergunta 1 ao PO.

## Resultado obtido

| Volumes | Desconto pela SPEC | Desconto na v2 |
|---|---|---|
| 3 | 0% | 0% |
| 10 | 5% pela tabela, 0% pelo texto | 0% |
| 15 | 5% | 5% |
| 19 | 5% | 5% |
| 20 | 10% | 5% |
| 30 | 10% | 10% |
| 49 | 10% | 10% |
| 50 | 15% | 10% |
| 80 | 15% | 15% |

Os quatro critérios de aceite (3, 15, 30 e 80 volumes) passam. O erro aparece só nos limites de 20 e 50 volumes, que nenhum critério testa.

Na cotação 65 da carga, com 20 volumes, a v2 aplica 5% e cobra R\$ 222,37. 
Com os 10% da SPEC, o valor seria R\$ 210,67.

## Causa

Em [src/pricing/v2.js:17-23](../src/pricing/v2.js#L17-L23), as faixas de desconto são comparadas com `>`:

```js
if (qtd > 50) return 0.15;
if (qtd > 20) return 0.10;
if (qtd > 10) return 0.05;
```

A alteração entrou no commit `1bf4b30` ("feat: desconto por volume conforme especificacao comercial").
A correção é trocar para `>=` nos limites de 50 e 20. No limite de 10, depende da resposta à pergunta 1 ao PO.

## Impacto

- **7 das 200 cotações da carga** têm exatamente 20 volumes e recebem 5% em vez de 10%.
- São **R$ 64,33** cobrados a mais.
- **Nenhuma cotação da carga chega a 50 volumes**, então a carga não mostra o erro de 15%. 
Mesmo assim, ele atinge justamente os pedidos com muitos volumes, que a SPEC cita como o público da política.
- **Condicional à pergunta 1:** se valer a tabela, as 36 cotações da carga com exatamente 10 volumes também ficam sem o desconto de 5%, somando mais R$ 392,30.
- A severidade é Alta porque cobra a mais do cliente, mas em poucas cotações da carga.

Para calcular o impacto financeiro, gerei um script simples:

Antes de executar, resete a base.

```bash
node scripts/impacto_003.js
```

## Evidência

Cotações de 5 kg, SP → SP, criadas na v2:

<pre>
20 volumes: {"id":214,"cliente":"Teste QA","peso_kg":5,<b>"volumes":20</b>,"uf_origem":"SP","uf_destino":"SP","faturada":false,"criada_em":"2026-09-27","valor_base":25,"multiplicador":1,<b>"desconto":0.05</b>,"valor_total":26.6}
50 volumes: {"id":215,"cliente":"Teste QA","peso_kg":5,<b>"volumes":50</b>,"uf_origem":"SP","uf_destino":"SP","faturada":false,"criada_em":"2026-09-27","valor_base":25,"multiplicador":1,<b>"desconto":0.1</b>,"valor_total":25.2}
</pre>

Cotação 65 da carga na v2:

<pre>
{"id":65,"cliente":"Rede Bom Preço","peso_kg":75.5,<b>"volumes":20</b>,"uf_origem":"BA","uf_destino":"RJ","faturada":false,"criada_em":"2026-06-10","valor_base":110,"multiplicador":1.9,<b>"desconto":0.05</b>,<b>"valor_total":222.37</b>}
</pre>