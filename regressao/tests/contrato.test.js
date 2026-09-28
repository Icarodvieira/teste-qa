// Risco 5 da MATRIZ: campos removidos, renomeados ou com formato diferente do README.
// Fonte: README, "Contrato da API", e SPEC, seção 3 (campo desconto).
// O contrato é o mesmo nas duas versões.

const api = require('../helpers/api');

const ITEM_DA_LISTAGEM = {
  id: expect.any(Number),
  cliente: expect.any(String),
  peso_kg: expect.any(Number),
  volumes: expect.any(Number),
  uf_origem: expect.any(String),
  uf_destino: expect.any(String),
  faturada: expect.any(Boolean),
  valor_total: expect.any(Number),
};

const DETALHE = {
  ...ITEM_DA_LISTAGEM,
  criada_em: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  valor_base: expect.any(Number),
  multiplicador: expect.any(Number),
  desconto: expect.any(Number),
};

const FATURA = {
  id: expect.any(Number),
  id_cotacao: expect.any(Number),
  cliente: expect.any(String),
  valor: expect.any(Number),
  emitida_em: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
};

describe.each(['v1', 'v2'])('%s: contrato da API', (versao) => {
  beforeEach(() => api.reset(versao));

  test('GET /api/versao informa a versão que responde', async () => {
    const { status, corpo } = await api.versao(versao);

    expect(status).toBe(200);
    expect(corpo).toEqual({ versao });
  });

  test('as respostas são JSON com charset=utf-8', async () => {
    const respostas = [await api.listar(versao), await api.detalhe(versao, 1), await api.detalhe(versao, 9999), await api.faturas(versao)];

    for (const { tipo } of respostas) expect(tipo).toBe('application/json; charset=utf-8');
  });

  describe('GET /api/cotacoes', () => {
    test('cada item traz exatamente os campos do README', async () => {
      const { status, corpo } = await api.listar(versao, '?limit=200');

      expect(status).toBe(200);
      for (const item of corpo.itens) expect(item).toEqual(ITEM_DA_LISTAGEM);
    });

    test('sem parâmetros, devolve a página 1 com 20 itens', async () => {
      const { corpo } = await api.listar(versao);

      expect(corpo.itens).toHaveLength(20);
      expect(corpo.itens[0].id).toBe(1);
    });

    test('page e limit escolhem a página: page=2&limit=5 devolve as cotações 6 a 10', async () => {
      const { corpo } = await api.listar(versao, '?page=2&limit=5');

      expect(corpo.itens.map((item) => item.id)).toEqual([6, 7, 8, 9, 10]);
    });

    test('total é a contagem de cotações, não o tamanho da página', async () => {
      const { corpo } = await api.listar(versao, '?limit=5');

      expect(corpo.total).toBe(200);
    });

    test('o filtro por cliente devolve só aquele cliente, e total conta o filtro', async () => {
      const { corpo } = await api.listar(versao, `?cliente=${encodeURIComponent('Comercial Aurora')}&limit=1000`);

      expect(corpo.itens.length).toBeGreaterThan(0);
      expect(corpo.total).toBe(corpo.itens.length);
      for (const item of corpo.itens) expect(item.cliente).toBe('Comercial Aurora');
    });

    test('o valor_total da listagem é o mesmo do detalhe, para as 200 cotações', async () => {
      const { corpo } = await api.listar(versao, '?limit=200');

      const divergentes = [];
      for (const item of corpo.itens) {
        const detalhe = await api.detalhe(versao, item.id);
        if (item.valor_total !== detalhe.corpo.valor_total) divergentes.push(item.id);
      }
      expect(divergentes.length).toBe(0);
    });
  });

  describe('GET /api/cotacoes/{id}', () => {
    test('traz exatamente os campos do README', async () => {
      const { status, corpo } = await api.detalhe(versao, 12);

      expect(status).toBe(200);
      expect(corpo).toEqual(DETALHE);
    });

    test('desconto é uma fração decimal: 0, 0.05, 0.1 ou 0.15 (SPEC, seção 3)', async () => {
      const { corpo } = await api.listar(versao, '?limit=200');

      for (const item of corpo.itens) {
        const detalhe = await api.detalhe(versao, item.id);
        expect([0, 0.05, 0.1, 0.15]).toContain(detalhe.corpo.desconto);
      }
    });

    test('cotação inexistente responde 404 com a mensagem do README', async () => {
      const { status, corpo } = await api.detalhe(versao, 9999);

      expect(status).toBe(404);
      expect(corpo).toEqual({ erro: 'Cotação não encontrada' });
    });
  });

  describe('POST /api/cotacoes', () => {
    test('201 devolve a cotação criada no mesmo formato do detalhe', async () => {
      const { status, corpo } = await api.criar(versao, api.novaCotacao(10, 'SP', 'RJ', 4));

      expect(status).toBe(201);
      expect(corpo).toEqual(DETALHE);
    });

    test('422 devolve um objeto com o campo erro', async () => {
      const { status, corpo } = await api.criar(versao, {});

      expect(status).toBe(422);
      expect(corpo).toEqual({ erro: expect.any(String) });
    });
  });

  describe('GET /api/faturas', () => {
    // Valida uma fatura emitida pela API. As faturas da carga inicial não têm o campo valor,
    // o que é um problema da massa de dados do ambiente, registrado na ESTRATEGIA.
    test('uma fatura emitida traz exatamente os campos do README', async () => {
      const emitida = await api.faturar(versao, 61);
      const { status, corpo } = await api.faturas(versao, '?id_cotacao=61');

      expect(emitida.corpo).toEqual(FATURA);
      expect(status).toBe(200);
      expect(corpo).toEqual([FATURA]);
    });

    test('o filtro id_cotacao devolve só as faturas daquela cotação', async () => {
      const { corpo } = await api.faturas(versao, '?id_cotacao=1');

      expect(corpo.length).toBeGreaterThan(0);
      for (const fatura of corpo) expect(fatura.id_cotacao).toBe(1);
    });
  });

  test('POST /_reset responde 200 com { ok: true }', async () => {
    const { status, corpo } = await api.reset(versao);

    expect(status).toBe(200);
    expect(corpo).toEqual({ ok: true });
  });
});
