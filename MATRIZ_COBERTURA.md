# Matriz de cobertura

<!-- Este arquivo é entregável. Preencha as seções abaixo. -->

## Como ler esta matriz

<!-- Explique sua legenda: o que significa cada nível de cobertura que você usar
     (por exemplo: automatizado / manual / não coberto). -->

**Automatizado?**
- **Sim:** cenário na suíte Jest de [regressao/](regressao/), executado na v1 e na v2 contra o valor esperado calculado a partir do README e da SPEC.
- **Parcial:** parte na suíte, parte em exploração manual.
- **Não:** exploração manual, no Postman ou na tela.

**Resultado e Situação**
- **Pendente:** ainda não executado.
- **Passou:** conforme o esperado nas duas versões.
- **Falhou:** divergente do esperado; a versão afetada e o bug correspondente ficam em "Problema aberto".
- **Não coberto:** fora do escopo, com a justificativa na ESTRATEGIA.

## Risco × cobertura

| # | Risco | Área | Como foi coberto | Automatizado? | Resultado | Problema aberto |
|---|---|---|---|---|---|---|
| 1 | A v2 quebra uma regra de preço que já funcionava | Regras de preço vigentes | Exemplos do README (valores fixos); combinações de faixa × tipo de rota, com um valor representativo de cada; bordas de faixa (10 / 10,01 / 50 / 50,01 / 100 / 100,01 kg) | Sim | Falhou | v2: [bug 001](bugs/001-peso-no-limite-cai-na-faixa-seguinte.md) |
| 2 | Desconto por volume aplicado errado | Desconto por volume | Critérios de aceite da SPEC (3, 15, 30 e 80 volumes); bordas de volume (1, 9, 10, 11, 19, 20, 49 e 50); as 36 combinações de faixa × tipo de rota × nível de desconto | Sim | Falhou | v2: [bug 003](bugs/003-limite-de-volume-recebe-desconto-menor.md) |
| 3 | Cotação faturada mais de uma vez, ou fatura com valor diferente da cotação | Faturamento | Faturar cotação em aberto (201, com o valor do detalhe); segunda tentativa (409); cotação inexistente (404); tentativas simultâneas da mesma cotação; na tela, clique duplo no botão Faturar | Parcial | Pendente | — |
| 4 | Cotação muda de valor depois de faturada ou de orçada | Não retroatividade | As 60 cotações faturadas da carga com o mesmo valor na v1 e na v2; as 140 em aberto com o valor da v1 (A confirmar com PO) | Sim | Pendente | — |
| 5 | Campos removidos, renomeados ou com formato diferente do README | Contrato da API | Campos e tipos de cada rota; `desconto` como fração (SPEC, seção 3); status e mensagens (201, 404, 409, 422); `valor_total` da listagem igual ao do detalhe; `total` como contagem do filtro; paginação e filtro por cliente | Sim | Falhou | v2: [bug 002](bugs/002-listagem-exibe-valor-sem-desconto.md) |
| 6 | Centavo diferente da regra comercial | Arredondamento | Um caso que arredonda para cima e um que arredonda para baixo; valor final sempre com duas casas | Sim | Pendente | — |
| 7 | Tela sem o percentual de desconto ou com valor diferente da API | Tela de operação | Percentual no detalhe; valor da tabela igual ao do detalhe | Não | Falhou | v2: [bug 002](bugs/002-listagem-exibe-valor-sem-desconto.md) |
| 8 | Dado inválido aceito, gravado ou gerando preço | Validação de entrada | Suíte: campos obrigatórios, limites de aceitação (peso 0 × 0,01; volumes 0 × 1) e peso negativo. Postman: peso não numérico, UF fora da lista ou minúscula, volumes fracionados, JSON malformado | Parcial | Pendente | — |
| 9 | Melhoria de performance não se confirma | Performance da listagem | Fora do escopo. O lado funcional da mudança está no risco 5 | Não | Não coberto | — |

## Cobertura por regra de negócio

<!-- Uma linha por regra documentada no README e na especificação. Serve para
     mostrar que você partiu dos requisitos, e não só do que a tela deixa clicar. -->

| Regra | Fonte | Cenários testados | Situação |
|---|---|---|---|
| Faixa de peso | README | Um peso em cada faixa; limites inclusivos 10, 50 e 100 kg contra 10,01, 50,01 e 100,01 kg; os 5 exemplos do README | Falhou (v2, bug 001) |
| Multiplicador de rota | README | Uma rota de cada tipo: mesma UF (SP→SP, 1,0), mesma região (SP→MG, 1,4) e regiões diferentes (SP→BA, 1,9) | Pendente |
| Imposto | README | Presente em todos os cenários de preço, conferido pelos 5 exemplos do README | Pendente |
| Arredondamento do valor final | README | Um caso que arredonda para cima e um que arredonda para baixo | Pendente |
| Fatura única por cotação | README | Segunda tentativa → 409 com "Cotação já faturada"; tentativas simultâneas → uma fatura só; cotação já faturada da carga → 409 | Pendente |
| Valor da fatura | README | Fatura emitida com o `valor_total` que o detalhe mostrava no momento da emissão | Pendente |
| Desconto por volume | SPEC | Critérios de aceite (3, 15, 30 e 80 volumes); bordas 9 × 10 × 11, 19 × 20 e 49 × 50; valor final com imposto e desconto | Falhou (v2, bug 003) |
| Exposição do desconto | SPEC | Campo `desconto` como fração (0, 0.05, 0.1, 0.15) no detalhe e na criação; percentual visível na tela de detalhe | Pendente |
| Não retroatividade | SPEC | Cotações faturadas com o mesmo valor na v1 e na v2; cotações em aberto criadas antes da v2 com o valor da v1 (A confirmar com PO) | Pendente |
| Contrato das rotas da API | README | Campos e tipos da listagem, do detalhe, da criação, das faturas (com filtro por cotação) e da versão; 404 para cotação inexistente no detalhe e no faturamento; 422 com `erro`; `valor_total` igual entre listagem e detalhe | Falhou (v2, bug 002) |
| Validação de entrada | README | Cada um dos 5 campos obrigatórios ausente; peso 0 × 0,01; volumes 0 × 1; peso negativo | Pendente |

## Lacunas conhecidas

<!-- O que ficou sem cobertura, com o risco correspondente. Deve conversar com a
     seção "O que decidi NÃO testar" da ESTRATEGIA.md. -->

| Lacuna | Risco correspondente | Justificativa |
|---|---|---|
| Performance e carga da listagem | Listagem lenta em base grande passar despercebida | ESTRATEGIA, "O que decidi NÃO testar" |
| Navegadores, responsividade e acessibilidade | Problema visual num navegador específico | ESTRATEGIA, "O que decidi NÃO testar" |
| Segurança aprofundada | Vulnerabilidades que já existem na v1 | ESTRATEGIA, "O que decidi NÃO testar" |
| Automação da tela | Uma regressão visual numa próxima release só seria vista na exploração manual | A tela é coberta manualmente; os valores que ela mostra vêm da API, que a suíte cobre |
| Esperado provisório em 10 volumes e nas cotações em aberto | Se o PO responder o contrário, parte dos resultados muda de "Passou" para "Falhou", ou o inverso | Depende das perguntas 1 e 2 ao PO; os cenários existem, e o resultado nas duas leituras fica registrado |
