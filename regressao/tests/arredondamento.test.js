// Risco 6 da MATRIZ: centavo diferente da regra comercial.
// Fonte: README, "Valor final": duas casas decimais, arredondado a partir de cinco milésimos.
// Só o desconto gera a terceira casa decimal, então este arquivo roda só na v2.

const api = require('../helpers/api');

function casasDecimais(valor) {
  return (String(valor).split('.')[1] ?? '').length;
}

describe('v2: arredondamento do valor final', () => {
  beforeAll(() => api.reset('v2'));

  // 30 kg SP → MG: 60 × 1,4 × 1,12 = 94,08 antes do desconto.
  test.each`
    volumes | semArredondar | esperado
    ${15}   | ${'89,376'}   | ${89.38}
    ${30}   | ${'84,672'}   | ${84.67}
  `('30 kg, SP → MG, $volumes volumes: $semArredondar arredonda para R$ $esperado', async ({ volumes, esperado }) => {
    const { corpo } = await api.criar('v2', api.novaCotacao(30, 'SP', 'MG', volumes));

    expect(corpo.valor_total).toBe(esperado);
    expect(casasDecimais(corpo.valor_total)).toBeLessThanOrEqual(2);
  });
});
