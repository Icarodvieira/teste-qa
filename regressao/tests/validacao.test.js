// Risco 8 da MATRIZ: dado inválido aceito, gravado ou gerando preço.
// Fonte: README, "POST /api/cotacoes": os cinco campos são obrigatórios, peso_kg precisa ser
// positivo e volumes no mínimo 1. Entrada inválida responde 422 com { erro }.

const api = require('../helpers/api');

const CAMPOS = ['cliente', 'peso_kg', 'volumes', 'uf_origem', 'uf_destino'];

function cotacaoCom(alteracao) {
  return { ...api.novaCotacao(10, 'SP', 'RJ', 1), ...alteracao };
}

describe.each(['v1', 'v2'])('%s: validação de entrada', (versao) => {
  beforeEach(() => api.reset(versao));

  test.each(CAMPOS)('sem o campo %s, responde 422 citando o campo', async (campo) => {
    const dados = cotacaoCom({});
    delete dados[campo];

    const { status, corpo } = await api.criar(versao, dados);

    expect(status).toBe(422);
    expect(corpo.erro).toContain(campo);
  });

  test.each(CAMPOS)('com o campo %s vazio, responde 422 citando o campo', async (campo) => {
    const { status, corpo } = await api.criar(versao, cotacaoCom({ [campo]: '' }));

    expect(status).toBe(422);
    expect(corpo.erro).toContain(campo);
  });

  test.each`
    peso_kg  | status
    ${0.01}  | ${201}
    ${0}     | ${422}
    ${-5}    | ${422}
    ${'abc'} | ${422}
  `('peso_kg $peso_kg responde $status', async ({ peso_kg, status }) => {
    const resposta = await api.criar(versao, cotacaoCom({ peso_kg }));

    expect(resposta.status).toBe(status);
  });

  test.each`
    volumes  | status
    ${1}     | ${201}
    ${0}     | ${422}
    ${-1}    | ${422}
    ${'abc'} | ${422}
  `('volumes $volumes responde $status', async ({ volumes, status }) => {
    const resposta = await api.criar(versao, cotacaoCom({ volumes }));

    expect(resposta.status).toBe(status);
  });

  test.each`
    entrada                   | alteracao
    ${'peso zero'}            | ${{ peso_kg: 0 }}
    ${'peso não numérico'}    | ${{ peso_kg: 'abc' }}
    ${'volumes não numérico'} | ${{ volumes: 'abc' }}
  `('depois de uma entrada com $entrada, nada é gravado e a listagem da tela (limit=500) continua respondendo', async ({ alteracao }) => {
    await api.criar(versao, cotacaoCom(alteracao));
    const { status, corpo } = await api.listar(versao, '?limit=500');

    expect(status).toBe(200);
    expect(corpo.total).toBe(200);
  });
});
