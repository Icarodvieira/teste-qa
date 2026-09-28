// Risco 4 da MATRIZ: cotação muda de valor depois de faturada ou de orçada.
// Fonte: SPEC, seção 5 ("a política não é retroativa") e pergunta 2 ao PO.
//
// Aqui o esperado é o próprio valor da v1: a regra é que o valor não mude entre as versões.
// As faturas da carga não têm o campo valor, então a referência é o detalhe da cotação na v1.

const api = require('../helpers/api');

async function cotacoesQueMudamDeValor(faturada) {
  const { corpo } = await api.listar('v1', '?limit=200');
  const cotacoes = corpo.itens.filter((item) => item.faturada === faturada);

  const mudaram = [];
  for (const cotacao of cotacoes) {
    const naV1 = await api.detalhe('v1', cotacao.id);
    const naV2 = await api.detalhe('v2', cotacao.id);
    if (naV1.corpo.valor_total !== naV2.corpo.valor_total) mudaram.push(cotacao.id);
  }
  return { total: cotacoes.length, mudaram };
}

describe('retroatividade: v1 × v2', () => {
  beforeAll(() => Promise.all([api.reset('v1'), api.reset('v2')]));

  test('as 60 cotações já faturadas mantêm na v2 o mesmo valor da v1', async () => {
    const { total, mudaram } = await cotacoesQueMudamDeValor(true);

    expect(total).toBe(60);
    expect(mudaram.length).toBe(0);
  });

  // Leitura adotada na pergunta 2 ao PO: a cotação em aberto é faturada pelo valor orçado.
  test('as 140 cotações em aberto, criadas antes da v2, mantêm na v2 o mesmo valor da v1 quando faturadas', async () => {
    const { total, mudaram } = await cotacoesQueMudamDeValor(false);

    expect(total).toBe(140);
    expect(mudaram.length).toBe(0);
  });
});
