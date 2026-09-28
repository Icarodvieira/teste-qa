// Risco 3 da MATRIZ: cotação faturada mais de uma vez, ou fatura com valor diferente da cotação.
// Fonte: README, "Regras de faturamento" e "POST /api/cotacoes/{id}/faturar".
// As regras são as mesmas nas duas versões.

const api = require('../helpers/api');

const COTACAO_EM_ABERTO = 61;
const COTACAO_FATURADA_NA_CARGA = 1;

describe.each(['v1', 'v2'])('%s: faturamento', (versao) => {
  beforeEach(() => api.reset(versao));

  test('faturar uma cotação em aberto responde 201 com o valor que o detalhe mostrava', async () => {
    const antes = await api.detalhe(versao, COTACAO_EM_ABERTO);
    const { status, corpo } = await api.faturar(versao, COTACAO_EM_ABERTO);
    const depois = await api.detalhe(versao, COTACAO_EM_ABERTO);

    expect(status).toBe(201);
    expect(corpo.id_cotacao).toBe(COTACAO_EM_ABERTO);
    expect(corpo.cliente).toBe(antes.corpo.cliente);
    expect(corpo.valor).toBe(antes.corpo.valor_total);
    expect(depois.corpo.faturada).toBe(true);
  });

  test('a segunda tentativa de faturar a mesma cotação responde 409 e não gera outra fatura', async () => {
    await api.faturar(versao, COTACAO_EM_ABERTO);
    const { status, corpo } = await api.faturar(versao, COTACAO_EM_ABERTO);
    const faturas = await api.faturas(versao, `?id_cotacao=${COTACAO_EM_ABERTO}`);

    expect(status).toBe(409);
    expect(corpo).toEqual({ erro: 'Cotação já faturada' });
    expect(faturas.corpo).toHaveLength(1);
  });

  test('uma cotação que já nasce faturada na carga responde 409', async () => {
    const { status, corpo } = await api.faturar(versao, COTACAO_FATURADA_NA_CARGA);
    const faturas = await api.faturas(versao, `?id_cotacao=${COTACAO_FATURADA_NA_CARGA}`);

    expect(status).toBe(409);
    expect(corpo).toEqual({ erro: 'Cotação já faturada' });
    expect(faturas.corpo).toHaveLength(1);
  });

  test('faturar uma cotação inexistente responde 404', async () => {
    const { status, corpo } = await api.faturar(versao, 9999);

    expect(status).toBe(404);
    expect(corpo).toEqual({ erro: 'Cotação não encontrada' });
  });

  // Dois pedidos disparados ao mesmo tempo, como um clique duplo rápido ou uma nova tentativa automática.
  test('dois pedidos simultâneos para a mesma cotação geram uma fatura só', async () => {
    const respostas = await Promise.all([
      api.faturar(versao, COTACAO_EM_ABERTO),
      api.faturar(versao, COTACAO_EM_ABERTO),
    ]);
    const faturas = await api.faturas(versao, `?id_cotacao=${COTACAO_EM_ABERTO}`);

    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(faturas.corpo).toHaveLength(1);
  });
});
