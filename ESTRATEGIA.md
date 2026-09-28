# Estratégia de teste

## Contexto e objetivo da validação

Validar se a nova política de descontos é aplicada corretamente e não interfere no cálculo já realizado em produção. 

Além do desconto, o CHANGELOG declara mais duas mudanças: uma listagem com payload mais enxuto e ajustes no fluxo de faturamento. 

A validação cobre as três, e também o que o CHANGELOG diz que não mudou.

É necessário confirmar se a v2 pode subir sem cobrar errado.

## Análise de risco

**Critério:** o impacto mede o efeito para o cliente e para a empresa (Crítico = cobrança errada em escala; Alto = valor divergente ou regra descumprida; Médio = operação atrapalhada; Baixo = sem efeito financeiro).
A probabilidade mede o quanto a v2 mexeu na área, segundo o CHANGELOG e a SPEC. A prioridade combina os dois.

| Área | O que pode dar errado | Impacto se acontecer | Probabilidade | Prioridade |
|---|---|---|---|---|
| Regras de preço vigentes (faixa de peso, multiplicador de rota, imposto) | Ao inserir o desconto no cálculo, a v2 pode quebrar uma regra que já funcionava. | Crítico: pode impactar a base inteira | Alta: o cálculo de preço foi alterado para incluir o desconto | 1 |
| Desconto por volume | Limites das faixas de volume aplicados errado, desconto calculado errado, desconto em pedido sem direito | Crítico: cobrança a mais ou a menos em todo pedido | Alta: feature nova, SPEC ambígua no limite de 10 | 2 |
| Faturamento | Descumprir as regras de faturamento do README (fatura duplicada, fatura emitida com valor diferente do da cotação, etc) | Crítico: cobrança em dobro ou pelo valor errado | Média: o CHANGELOG declara ajustes no caminho de gravação da fatura | 3 |
| Não retroatividade | Cotações já faturadas mudam de valor na v2; cotações em aberto mudam de valor depois de orçadas (pela interpretação adotada na pergunta 2 ao PO) | Alto: o valor exibido diverge do cobrado, e o cliente recebe um preço diferente do orçado | Média: a SPEC cita restrição em cotações já faturadas, mas gerou dúvida | 4 |
| Contrato da API | Na listagem, o "payload enxuto" remove ou renomeia campos; na criação e no detalhe, o formato muda apesar de declarado sem alteração | Alto: quebra quem consome a API e mostra ao operador um valor diferente do que será faturado | Média: a mudança no payload da listagem está descrita no CHANGELOG como "apenas o que a tabela da tela precisa exibir"; criação e detalhe estão em "Sem alterações" | 5 |
| Arredondamento | O valor final sai com centavo diferente da regra do README | Alto: centavos por cotação, mas de forma sistemática em toda a base | Média: o cálculo foi alterado e a SPEC não cita arredondamento diretamente | 6 |
| Tela de operação | O percentual de desconto não aparece no detalhe, ou a tela mostra um valor diferente | Alto: Valor exibido diferente do que foi orçado/faturado e desconto não fica claro.| Média: a tela recebeu o campo de desconto e a listagem ficou mais enxuta | 7 |
| Validação de entrada | Dados inválidos são aceitos e geram preço ou erro | Alto: um registro inválido gravado pode comprometer as consultas que o incluem | Baixa: o CHANGELOG diz que a rota de criação não mudou | 8 |
| Performance da listagem | A melhoria de performance prometida não se confirma ou causa piora | Baixo: sem efeito financeiro | Baixa: é a própria mudança declarada | 9 |

## Fontes de verdade usadas

README para as regras da v1, SPEC para a nova feature de desconto, CHANGELOG e commits como referência do que mudou.


## Abordagem por área

| Área | Como | Por quê |
|---|---|---|
| Preço, desconto, arredondamento | Valores esperados calculados a partir do README e da SPEC. Casos de borda, exemplos do README e critérios de aceite com teste automatizado Jest | Maior risco, e a regra é determinística |
| Faturamento | Exploração da tela e Postman e automação | O fluxo de faturamento é crítico e precisa ser testada também sob uso real |
| Não retroatividade | Comparação v1 × v2 do valor de cotações faturadas e em aberto da carga | Garantir que os valores não mudam da v1 para v2 |
| Contrato da API | Testes de contrato na suíte Jest, usando README e SPEC como fonte | É necessário para validar o contrato de API nessa e nas futuras releases |
| Tela de operação | Exploratório manual | São poucos fluxos e a verificação é visual. |
| Validação de entrada | Automatizado: as regras de validação do README. Exploratório com o Postman: entradas sem regra definida | A regra escrita é barata de automatizar. As entradas sem regra definida precisam ser exploradas antes de terem um esperado. |
| Todas | Leitura do código e do histórico | Para entender o que foi feito e indicar a causa provável |
| Impacto dos problemas | Consulta à API das duas versões sobre a carga inicial; para os problemas com valor em reais, um script simples em `scripts/` | O impacto precisa ser medido na carga e reproduzível por outra pessoa |

## O que decidi NÃO testar

| Ficou de fora | Por quê | Risco que estou aceitando |
|---|---|---|
| Performance e carga | Sem efeito financeiro, é interessante existir para futuras releases mas aqui focarei na parte funcional. | Listagem lenta em base grande passar despercebida |
| Navegadores, responsividade, acessibilidade | Sistema de uso interno e sem mudança de layout declarada | Problema visual num navegador específico |
| Segurança aprofundada (pentest) | Fora do escopo desta validação: a v2 não declara nenhuma mudança de segurança. | Vulnerabilidades que já existem na v1 |

## Ambiente e dados

- v1 e v2 rodando em processos separados (cada um com os próprios dados em memória.)
- Carga inicial que foi disponibilizada e volta ao estado inicial com `POST /_reset`
- As 60 faturas da carga inicial não têm o campo `valor`, que o README define ([src/seed.js:26-35](src/seed.js#L26-L35)). As faturas emitidas pela API têm. É um problema da massa de dados, não do produto, e existe nas duas versões.
- Exploração manual no Postman com um environment para cada versão.
- Scripts de impacto em `scripts/`, que consultam a API e comparam a base inicial das duas versões.

## Limitações da minha análise

- **A carga inicial não cobre todas as combinações.** Ela tem só 22 das 48 combinações de faixa de peso × tipo de rota × nível de desconto: nenhuma rota dentro da mesma UF e nenhum pedido com mais de 23 volumes. O impacto medido na carga não enxerga essas classes (o erro no limite de 50 volumes, por exemplo, dá zero na carga). A suíte cria cotações novas para cobrir as 48.
- **As faturas da carga não têm o campo `valor`.** Não dá para comparar o valor exibido com o valor efetivamente faturado. Para a não retroatividade, comparo o valor da v2 com o da v1, que é a versão pela qual essas cotações foram faturadas.