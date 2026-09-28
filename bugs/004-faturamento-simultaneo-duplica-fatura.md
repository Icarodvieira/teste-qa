# [004] Dois pedidos simultâneos de faturamento geram fatura duplicada

**Severidade:** Alta
**Versão afetada:** ambas, no ambiente fornecido
**Ambiente:** v2 em `http://localhost:3002` (RC) e v1 em `http://localhost:3001` (PROD), usando a carga inicial

**Resumo:** quando dois pedidos de faturamento da mesma cotação chegam com menos de 15 ms de diferença, os dois são aceitos, e a cotação fica com duas faturas do mesmo valor. 
Pela tela, com um clique duplo comum, o problema não se reproduz. 
Pela API, com pedidos simultâneos, ele se reproduz sempre.

## Passos para reproduzir

1. Com a carga inicial, enviar dois pedidos de faturamento ao mesmo tempo para a cotação 61, que está em aberto:
   ```bash
   curl -s -X POST http://localhost:3002/api/cotacoes/61/faturar & curl -s -X POST http://localhost:3002/api/cotacoes/61/faturar & wait
   ```
2. Consultar as faturas da cotação 61:
   ```bash
   curl -s "http://localhost:3002/api/faturas?id_cotacao=61"
   ```
3. Repetir na v1, trocando a porta para 3001.

## Resultado esperado

- **README, "Regras de faturamento":** "Uma cotação só pode ser faturada uma única vez." e "Uma segunda tentativa de faturar a mesma cotação deve ser recusada com status `409` e a mensagem `Cotação já faturada`."

## Resultado obtido

Os dois pedidos recebem `201`, e a cotação 61 fica com duas faturas (ids 61 e 62), com o mesmo valor. O mesmo acontece na v1.

O problema depende do intervalo entre os dois pedidos. Medido com 5 tentativas por intervalo, na v2:

| Intervalo entre os pedidos | Tentativas que geraram fatura duplicada |
|---|---|
| 0 ms | 5 de 5 |
| 5 ms | 5 de 5 |
| 10 ms | 4 de 5 |
| 14 ms | 3 de 5 |
| 16 ms ou mais | 0 de 5 |

## Causa Provável

Em [src/faturas.js](../src/faturas.js), a função `faturar` confere se a cotação já foi faturada (linha 11), espera 15 ms (linha 14) e só depois grava a fatura e marca a cotação como faturada (linhas 23 e 24):

```js
if (cotacao.faturada) return { status: 409, corpo: { erro: 'Cotação já faturada' } };

const { valor_total } = motor.precificar(cotacao);
await new Promise((resolve) => setTimeout(resolve, 15));
// ...
store.faturas.push(fatura);
cotacao.faturada = true;
```

Um segundo pedido que chegue durante a espera encontra a cotação ainda não marcada e passa pela conferência.

A espera entrou no commit `079f906` ("feat: emissao de fatura a partir da cotacao"). O CHANGELOG da v2 cita "ajustes na emissão de fatura para deixar o caminho de gravação mais próximo do que será usado quando o armazenamento sair da memória". As duas versões usam o mesmo `faturas.js` neste ambiente, por isso o problema aparece também na v1. Não dá para afirmar se a produção atual tem o mesmo código.

A correção é marcar a cotação como faturada antes da espera, para que a conferência e a marcação aconteçam juntas, desfazendo a marcação se a gravação falhar. Com banco de dados, o equivalente é uma restrição de unicidade por cotação nas faturas. Testei a primeira opção numa cópia do código: os dois pedidos simultâneos passam a responder um `201` e um `409`, com uma fatura só. Desabilitar o botão durante o pedido ajuda, mas não substitui a correção no servidor, porque não protege quem chama a API diretamente.

## Impacto

- **Quando acontece, o cliente é cobrado duas vezes** pelo valor inteiro da cotação.
- **Na carga inicial, nenhuma fatura está duplicada:** são 60 faturas para 60 cotações diferentes. As 140 cotações em aberto estão expostas.
- **A probabilidade é baixa pela tela** e real pela API: basta uma integração, uma nova tentativa automática depois de um timeout ou dois operadores na mesma cotação. Com armazenamento real, a janela deixa de ser os 15 ms simulados e passa a ser o tempo real de gravação.
- A severidade é Alta porque cobra em dobro quando ocorre, mas depende de pedidos simultâneos e não acontece em escala. Como afeta as duas versões, não é uma regressão comprovada da v2.

## Evidência

Dois pedidos simultâneos na v2:

<pre>
{<b>"id":61</b>,"id_cotacao":61,"cliente":"Metalúrgica Vale","valor":222.37,"emitida_em":"2026-09-27"}
{<b>"id":62</b>,"id_cotacao":61,"cliente":"Metalúrgica Vale","valor":222.37,"emitida_em":"2026-09-27"}
</pre>

Faturas da cotação 61 depois dos dois pedidos:

<pre>
[{"id":61,<b>"id_cotacao":61</b>,"cliente":"Metalúrgica Vale","valor":222.37,"emitida_em":"2026-09-27"},{"id":62,<b>"id_cotacao":61</b>,"cliente":"Metalúrgica Vale","valor":222.37,"emitida_em":"2026-09-27"}]
</pre>

Na suíte de regressão, o teste "dois pedidos simultâneos para a mesma cotação geram uma fatura só" ([regressao/tests/faturamento.test.js](../regressao/tests/faturamento.test.js)) falha nas duas versões: os dois pedidos respondem `201`, quando o esperado era um `201` e um `409`.
