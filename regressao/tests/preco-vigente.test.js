// Risco 1 da MATRIZ: a v2 quebra uma regra de preço que já funciona em produção.
// Fonte: README, "Regras de precificação". Todos os casos usam 1 volume, sem desconto,
// então o valor esperado é o mesmo nas duas versões.
//
// valor final = valor base da faixa × multiplicador da rota × 1,12, com duas casas

const api = require('../helpers/api');

describe.each(['v1', 'v2'])('%s: regras de preço vigentes', (versao) => {
  beforeAll(() => api.reset(versao));
  // Exemplos conferidos com o comercial.
  test.each`
    peso   | origem  | destino | esperado
    ${10}  | ${'SP'} | ${'SP'} | ${28.0}
    ${5}   | ${'SP'} | ${'BA'} | ${53.2}
    ${50}  | ${'SP'} | ${'BA'} | ${127.68}
    ${100} | ${'SP'} | ${'MG'} | ${172.48}
    ${150} | ${'SP'} | ${'MG'} | ${282.24}
  `('exemplo do README: $peso kg, $origem → $destino, custa R$ $esperado', async ({ peso, origem, destino, esperado }) => {
    const { status, corpo } = await api.criar(versao, api.novaCotacao(peso, origem, destino));

    expect(status).toBe(201);
    expect(corpo.valor_total).toBe(esperado);
  });


  test.each`
    peso      | base   | esperado
    ${10}     | ${25}  | ${28.0}
    ${10.01}  | ${60}  | ${67.2}
    ${50}     | ${60}  | ${67.2}
    ${50.01}  | ${110} | ${123.2}
    ${100}    | ${110} | ${123.2}
    ${100.01} | ${180} | ${201.6}
  `('limite de faixa: $peso kg usa a base de R$ $base', async ({ peso, base, esperado }) => {
    const { corpo } = await api.criar(versao, api.novaCotacao(peso, 'SP', 'SP'));

    expect(corpo.valor_base).toBe(base);
    expect(corpo.valor_total).toBe(esperado);
  });

  // As 12 combinações de faixa de peso × tipo de rota, com um peso representativo de cada faixa.
  test.each`
    peso   | origem  | destino | multiplicador | esperado
    ${5}   | ${'SP'} | ${'SP'} | ${1}          | ${28.0}
    ${5}   | ${'SP'} | ${'MG'} | ${1.4}        | ${39.2}
    ${5}   | ${'SP'} | ${'BA'} | ${1.9}        | ${53.2}
    ${30}  | ${'SP'} | ${'SP'} | ${1}          | ${67.2}
    ${30}  | ${'SP'} | ${'MG'} | ${1.4}        | ${94.08}
    ${30}  | ${'SP'} | ${'BA'} | ${1.9}        | ${127.68}
    ${75}  | ${'SP'} | ${'SP'} | ${1}          | ${123.2}
    ${75}  | ${'SP'} | ${'MG'} | ${1.4}        | ${172.48}
    ${75}  | ${'SP'} | ${'BA'} | ${1.9}        | ${234.08}
    ${150} | ${'SP'} | ${'SP'} | ${1}          | ${201.6}
    ${150} | ${'SP'} | ${'MG'} | ${1.4}        | ${282.24}
    ${150} | ${'SP'} | ${'BA'} | ${1.9}        | ${383.04}
  `('$peso kg, $origem → $destino (multiplicador $multiplicador) custa R$ $esperado', async ({ peso, origem, destino, multiplicador, esperado }) => {
    const { corpo } = await api.criar(versao, api.novaCotacao(peso, origem, destino));

    expect(corpo.multiplicador).toBe(multiplicador);
    expect(corpo.valor_total).toBe(esperado);
  });
});
