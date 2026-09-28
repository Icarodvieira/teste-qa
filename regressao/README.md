# Suíte de regressão

Suíte automatizada que roda os mesmos cenários na v1 (produção) e na v2 (release candidate) e compara cada resultado com o que o README e a SPEC definem.

## Como rodar

Requer Node.js 18 ou superior. A partir da raiz do repositório:

```bash
cd regressao
npm install
npm test
```

O `npm install` instala só o Jest. 


### Contra um ambiente já no ar

Para testar um ambiente que já está rodando, como uma homologação, basta informar os endereços. 
Nesse caso a suíte não sobe instâncias próprias:

```bash
V1_URL=http://localhost:3001 V2_URL=http://localhost:3002 npm test
```

A suíte chama `POST /_reset` antes dos testes que mudam dados, então os dados desse ambiente voltam à carga inicial.

### No GitHub Actions

O pipeline [.github/workflows/regressao.yml](../.github/workflows/regressao.yml) roda a suíte no Node 18, numa máquina limpa. 

Ele é disparado manualmente, pela aba Actions do repositório, em "Regressão" → "Run workflow". 

## Pré-condições

- **Node.js 18 ou superior.**
- **As portas 4101 e 4102 livres.** A suíte sobe a v1 na 4101 e a v2 na 4102, em processos separados, e derruba as duas no fim. 
Por padrão ela não usa as portas 3001 e 3002, então não interfere em servidores abertos manualmente.
- **Nenhum dado prévio.** A suíte chama `POST /_reset` antes de cada teste que cria ou fatura cotações, então o resultado não depende do estado anterior.

## Ferramenta escolhida e por quê

Jest com o `fetch` nativo do Node.

O principal motivo da escolha foi manter os testes simples e com a mesma stack do resto da aplicação. Além disso, as tabelas do `test.each` deixam o valor esperado escrito ao lado de cada caso, e isso torna os cenários fáceis de ler e de conferir à mão. 

O Postman ficou para a exploração manual


## Cenários cobertos

Um arquivo por risco da [MATRIZ_COBERTURA.md](../MATRIZ_COBERTURA.md):

| # | Cenário | O que protege | v1 esperado | v2 esperado |
|---|---|---|---|---|
| 1 | [preco-vigente](tests/preco-vigente.test.js): os 5 exemplos do README, os limites de faixa (10 × 10,01, 50 × 50,01, 100 × 100,01 kg) e as 12 combinações de faixa × tipo de rota, sem desconto | Risco 1: as regras de preço que já funcionam em produção | os valores do README | os mesmos valores |
| 2 | [desconto](tests/desconto.test.js): os 4 critérios de aceite da SPEC, os limites de volume (1, 9, 10, 11, 19, 20, 49, 50) e as 36 combinações de faixa × rota × nível de desconto | Risco 2: o desconto por volume | não se aplica, porque a v1 não tem desconto | o percentual e o valor descritos na SPEC|
| 3 | [arredondamento](tests/arredondamento.test.js): um valor que arredonda para cima e um que arredonda para baixo | Risco 6: a regra comercial de arredondamento | não se aplica, porque sem desconto não há terceira casa decimal | 89,38 e 84,67 |
| 4 | [contrato](tests/contrato.test.js): campos e tipos de cada rota, `desconto` como fração, 404, 422, paginação, filtro por cliente, `total` como contagem, `valor_total` igual entre listagem e detalhe, charset | Risco 5: o contrato da API | o formato do README | o mesmo formato |
| 5 | [faturamento](tests/faturamento.test.js): 201 com o valor do detalhe, 409 na segunda tentativa e na cotação já faturada da carga, 404, dois pedidos simultâneos | Risco 3: fatura única e pelo valor exibido | as regras do README | as mesmas regras |
| 6 | [retroatividade](tests/retroatividade.test.js): as 60 cotações faturadas e as 140 em aberto, comparadas cotação por cotação entre as versões | Risco 4: a política não é retroativa | é a referência | o mesmo valor da v1 |
| 7 | [validacao](tests/validacao.test.js): cada campo obrigatório ausente e vazio; peso e volumes no limite, zero, negativos e como texto; entrada recusada não pode ficar gravada | Risco 8: dado inválido aceito ou gravado | as regras do README | as mesmas regras |

## Como a suíte compara v1 e v2

A suíte usa duas formas de comparação, conforme a regra:

1. **Cada versão contra o valor esperado.** Preço vigente, contrato, faturamento e validação rodam nas duas versões, com o mesmo esperado, escrito nas tabelas dos testes. 

     Os valores saem das regras do README e da SPEC.

     A comparação entre as versões aparece no resultado: quando a v1 passa e a v2 falha no mesmo caso, a v2 mudou algo que funciona em produção. 

     A v1 passar nos cenários de preço também confirma que os valores esperados batem com a produção.

2. **A v2 contra a v1, diretamente.** Na retroatividade, a regra é que o valor não mude entre as versões, então o esperado é o próprio valor da v1, cotação por cotação.

Desconto e arredondamento rodam só na v2, porque a v1 não tem desconto por definição.

## O que esta suíte NÃO cobre

- **A tela de operação.** É coberta por exploração manual, e os valores que ela mostra vêm da API, que a suíte cobre.
- **Performance, carga e segurança**, fora do escopo pela [ESTRATEGIA.md](../ESTRATEGIA.md).

## Saída esperada

Com a v1 e a v2 atuais:

```
Test Suites: 7 failed, 7 total
Tests:       41 failed, 141 passed, 182 total
```

Todas as falhas estão explicadas:

| Arquivo | Versão | Falhas | Causa |
|---|---|---|---|
| preco-vigente | v2 | 8 | [bug 001](../bugs/001-peso-no-limite-cai-na-faixa-seguinte.md) em 6 (pesos no limite de faixa); [bug 005](../bugs/005-valor-final-truncado-em-vez-de-arredondado.md) em 2 (150 kg SP → MG) |
| desconto | v2 | 18 | [bug 003](../bugs/003-limite-de-volume-recebe-desconto-menor.md) em 3 (20, 50 e 10 volumes, este pela pergunta 1); [bug 005](../bugs/005-valor-final-truncado-em-vez-de-arredondado.md) em 15 (desconto correto, valor 1 ou 2 centavos abaixo) |
| arredondamento | v2 | 1 | [bug 005](../bugs/005-valor-final-truncado-em-vez-de-arredondado.md) |
| contrato | v2 | 2 | [bug 002](../bugs/002-listagem-exibe-valor-sem-desconto.md) |
| faturamento | v1 e v2 | 1 em cada | [bug 004](../bugs/004-faturamento-simultaneo-duplica-fatura.md) |
| retroatividade | v1 × v2 | 2 | [bug 006](../bugs/006-cotacao-faturada-recalculada-na-v2.md) nas faturadas (29 de 60 mudam) nas abertas (82 de 140 mudam) |
| validacao | v1 e v2 | 4 em cada | [bug 007](../bugs/007-peso-nao-numerico-gravado-derruba-listagem.md) |

Cada falha mostra o esperado e o recebido. Por exemplo:

```
● v2: regras de preço vigentes › limite de faixa: 10 kg usa a base de R$ 25

    expect(received).toBe(expected) // Object.is equality

    Expected: 25
    Received: 60
```
