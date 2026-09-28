# Perguntas ao Product Owner


## Perguntas em aberto


### 1. Exatamente 10 volumes tem desconto?

**Onde apareceu:** na SPEC, na tabela de regras de desconto.

**O que está ambíguo:**
A tabela que descreve a regra de desconto ligado aos volumes, diz "10 a 19 → 5%", mas o texto abaixo diz que a política "vale para pedidos acima de 10 volumes".

**O que a v1 faz hoje:** Não se aplica: a v1 não tem desconto.
**O que a v2 faz:** 10 volumes ficam sem desconto, ou seja, ela segue o texto e não a tabela.

**Por que isso importa:** Se ficar mal definida, o sistema passa a conceder desconto a quem não tem direito, ou a negar a quem tem, em todo pedido com exatamente 10 volumes. 
Por exemplo: na carga inicial, 36 cotações têm 10 volumes, resultado em uma diferença de R$ 392,30 entre as leituras.

**Interpretação que adotei enquanto não há resposta:**
vale a tabela, porque é a regra mais específica e os critérios de aceite são escritos em faixas.

Se o PO confirmar o texto, 10 volumes ficam sem desconto, e esse caso deixa de ser defeito: a v2 já se comporta assim, e as 36 cotações não precisam de ajuste. O bug 003 fica só com os limites de 20 e 50 volumes.

**Bloqueia o go/no-go?** Sim, o limite da política de desconto precisa estar definido antes de a v2 ir para produção para evitar conceder ou bloquear desconto indevidamente. 
É uma definição rápida, basta confirmar qual leitura vale que o ajuste em código é pontual, não deve atrasar a release.

---

### 2. Cotações não faturadas e criadas antes da v2, recebem o desconto quando forem faturadas?

**Onde apareceu:** Nas regras de faturamento no README e nas restrições da SPEC.

**O que está ambíguo:**
A SPEC diz que a política "não é retroativa", mas só explica o que acontece com as cotações **já faturadas** ("mantêm o valor pelo qual foram faturadas"). Não diz nada sobre cotações criadas antes da v2 e ainda não faturadas. 

O README cita que "A fatura é emitida pelo valor final vigente da cotação no momento da emissão."

Isso me gerou dúvida se o valor final deve ser o **vigente no momento da cotação** ou o da nova regra de descontos.

**O que a v1 faz hoje:** Não se aplica: a v1 não tem desconto.

**O que a v2 faz:** Recalcula as cotações em aberto. 
Por exemplo, a cotação 61 custa R\$ 234,08 na v1 e R\$ 222,37 na v2.

**Por que isso importa:**
Define se o cliente é cobrado pelo valor que recebeu no orçamento ou pela nova politica de descontos.

Na carga inicial, 140 das 200 cotações estão em aberto.

**Interpretação que adotei enquanto não há resposta:**
A de que o valor do faturamento deve ser o mesmo da cotação original para o cliente (sem desconto). Seguindo a meta descrita na spec de "dar previsibilidade de preço ao cliente".

Se o PO decidir pela regra vigente na emissão da fatura, as cotações em aberto passam a receber o desconto ao serem faturadas, e o recálculo delas não é defeito. 
Na carga inicial, 94 das 140 abertas teriam direito ao desconto, e o faturamento delas somaria **R\$ 1.159,20** a menos. 
Se o PO também confirmar o texto na pergunta 1 (10 volumes sem desconto), seriam 69 cotações e **R\$ 880,99** a menos.

**Bloqueia o go/no-go?** Sim. No dia da subida, todas as cotações em aberto já existentes caem numa das duas leituras, e o sistema precisa aplicar a correta.


---

## Decisões que tomei sem perguntar

<!-- Ambiguidades menores que você resolveu sozinho por não valerem uma ida ao
     PO. Diga qual interpretação adotou e por quê. -->
