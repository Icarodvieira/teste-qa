# [001] Peso exatamente no limite da faixa é cobrado pela faixa seguinte

**Severidade:** Crítica
**Versão afetada:** v2
**Ambiente:** v2 em `http://localhost:3002` (RC), comparada com a v1 em `http://localhost:3001` (PROD), usando a carga inicial

## Passos para reproduzir

1. Consultar a cotação 30 da carga inicial (100 kg, SP → MG, 8 volumes, sem direito a desconto) nas duas versões:
   ```bash
   curl -s http://localhost:3001/api/cotacoes/30
   curl -s http://localhost:3002/api/cotacoes/30
   ```
   Ou pela tela, selecionando a cotação na listagem

2. Criar, nas duas versões, uma cotação de exatamente 10 kg:
   ```bash
   curl -s -X POST http://localhost:3002/api/cotacoes -H "Content-Type: application/json" \
     -d '{"cliente":"Teste QA","peso_kg":10,"volumes":1,"uf_origem":"SP","uf_destino":"SP"}'
   ```
3. Repetir o passo 2 com 50 kg e 100 kg, e com 10,01, 50,01 e 100,01 kg, para comparar o limite com o valor logo acima dele.

## Resultado esperado

- **README, "Faixa de peso":** os limites são **inclusivos**. "Uma cotação de exatamente 10 kg pertence à primeira faixa, uma de exatamente 50 kg à segunda, e uma de exatamente 100 kg à terceira."
- **SPEC, seção 2:** a política de desconto "não altera em nada a tabela de faixa de peso", que permanece "exatamente como está hoje em produção".
- **CHANGELOG:** não declara nenhuma mudança na faixa de peso.

## Resultado obtido

Na v2, o peso exatamente no limite cai na faixa de cima. O valor logo acima do limite continua certo, então só o limite está errado.

| Peso | Faixa pelo README | valor_base v1 |valor_base v2 |  
|---|---|---|---|
| 10 kg | R$ 25 | R$ 25 | R$ 60 |
| 10,01 kg | R$ 60 | R$ 60 | R$ 60 |
| 50 kg | R$ 60 | R$ 60 | R$ 110 |
| 50,01 kg | R$ 110 | R$ 110 | R$ 110 |
| 100 kg | R$ 110 | R$ 110 | R$ 180 |
| 100,01 kg | R$ 180 | R$ 180 | R$ 180 |

Três dos cinco exemplos do README falham na v2 por causa disso:

| Exemplo do README | Esperado | v2 |
|---|---|---|
| 10 kg SP → SP | R$ 28,00 | R$ 67,20 |
| 50 kg SP → BA | R$ 127,68 | R$ 234,08 |
| 100 kg SP → MG | R$ 172,48 | R$ 282,22 |


## Causa

Em [src/pricing/v2.js:26](../src/pricing/v2.js#L26), a faixa foi alterada para `<`:

```js
const faixa = FAIXAS.find((f) => Number(cotacao.peso_kg) < f.ate);
```

A v1 usa `<=` ([src/pricing/v1.js:18](../src/pricing/v1.js#L18)), que é o que torna os limites inclusivos. 

A alteração entrou no commit `0face53` ("feat: motor de precificacao da versao 2"). 
A correção é voltar para `<=`.

## Impacto

- **20 das 200 cotações da carga (10%)** têm a faixa errada na v2: 6 faturadas e 14 em aberto, todas com peso de exatamente 10, 50 ou 100 kg.

- São **R$ 2.032,87** cobrados a mais.


Para calcular o impacto financeiro, gerei um script simples:

Antes de executar, resete a base.

```bash
node scripts/impacto.js
```


Como o script conta: uma cotação é afetada quando o `valor_base` da v2 difere do da v1, que segue a tabela do README. 
A diferença em dinheiro compara o valor da v2 com a base errada e com a base correta, mantendo o multiplicador e o desconto que a própria v2 aplicou. 



## Evidência

Detalhe da cotação 30:

```text
v1: {"id":30,"peso_kg":100,"volumes":8,"uf_origem":"SP","uf_destino":"MG","valor_base":110,"multiplicador":1.4,"desconto":0,"valor_total":172.48}
v2: {"id":30,"peso_kg":100,"volumes":8,"uf_origem":"SP","uf_destino":"MG","valor_base":180,"multiplicador":1.4,"desconto":0,"valor_total":282.22}
```

Saída de `node scripts/impacto.js`:

```text
Cotações com a faixa errada na v2: 20 de 200
  cotação 11: 100 kg → base de 110 para 180 → R$ 141,51 a mais
  cotação 22: 50 kg → base de 60 para 110 → R$ 95,76 a mais
  cotação 30: 100 kg → base de 110 para 180 → R$ 109,76 a mais
  cotação 33: 10 kg → base de 25 para 60 → R$ 70,76 a mais
  cotação 44: 100 kg → base de 110 para 180 → R$ 134,07 a mais
  cotação 55: 50 kg → base de 60 para 110 → R$ 106,40 a mais
  cotação 66: 10 kg → base de 25 para 60 → R$ 49,39 a mais
  cotação 77: 100 kg → base de 110 para 180 → R$ 148,96 a mais
  cotação 88: 50 kg → base de 60 para 110 → R$ 101,08 a mais
  cotação 99: 10 kg → base de 25 para 60 → R$ 74,48 a mais
  cotação 110: 100 kg → base de 110 para 180 → R$ 141,51 a mais
  cotação 121: 50 kg → base de 60 para 110 → R$ 106,40 a mais
  cotação 130: 10 kg → base de 25 para 60 → R$ 70,76 a mais
  cotação 132: 10 kg → base de 25 para 60 → R$ 52,14 a mais
  cotação 143: 100 kg → base de 110 para 180 → R$ 148,96 a mais
  cotação 154: 50 kg → base de 60 para 110 → R$ 106,40 a mais
  cotação 165: 10 kg → base de 25 para 60 → R$ 74,48 a mais
  cotação 176: 100 kg → base de 110 para 180 → R$ 141,51 a mais
  cotação 187: 50 kg → base de 60 para 110 → R$ 106,40 a mais
  cotação 198: 10 kg → base de 25 para 60 → R$ 52,14 a mais
Total cobrado a mais: R$ 2.032,87
```
