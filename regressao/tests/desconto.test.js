// Risco 2 da MATRIZ: desconto por volume aplicado errado.
// Fonte: SPEC, seções 2 e 4. O desconto só existe na v2, então este arquivo roda só na v2.
//
// valor final = valor base × multiplicador × 1,12 × (1 − desconto), com duas casas

const api = require('../helpers/api');

describe('v2: desconto por volume', () => {
  beforeAll(() => api.reset('v2'));

  // Critérios de aceite da SPEC, com 5 kg SP → SP (R$ 28,00 sem desconto).
  test.each`
    volumes | desconto | esperado
    ${3}    | ${0}     | ${28.0}
    ${15}   | ${0.05}  | ${26.6}
    ${30}   | ${0.1}   | ${25.2}
    ${80}   | ${0.15}  | ${23.8}
  `('critério de aceite: $volumes volumes recebem $desconto de desconto', async ({ volumes, desconto, esperado }) => {
    const criada = await api.criar('v2', api.novaCotacao(5, 'SP', 'SP', volumes));
    const detalhe = await api.detalhe('v2', criada.corpo.id);

    expect(criada.corpo.desconto).toBe(desconto);
    expect(criada.corpo.valor_total).toBe(esperado);
    expect(detalhe.corpo.desconto).toBe(desconto);
  });

  // Limites da tabela de desconto, com 5 kg SP → SP.
  // 10 volumes segue a tabela da SPEC ("10 a 19 → 5%"), leitura adotada na pergunta 1 ao PO.
  test.each`
    volumes | desconto | esperado
    ${1}    | ${0}     | ${28.0}
    ${9}    | ${0}     | ${28.0}
    ${10}   | ${0.05}  | ${26.6}
    ${11}   | ${0.05}  | ${26.6}
    ${19}   | ${0.05}  | ${26.6}
    ${20}   | ${0.1}   | ${25.2}
    ${49}   | ${0.1}   | ${25.2}
    ${50}   | ${0.15}  | ${23.8}
  `('limite de volume: $volumes volumes recebem $desconto de desconto', async ({ volumes, desconto, esperado }) => {
    const { corpo } = await api.criar('v2', api.novaCotacao(5, 'SP', 'SP', volumes));

    expect(corpo.desconto).toBe(desconto);
    expect(corpo.valor_total).toBe(esperado);
  });

  // As 36 combinações de faixa de peso × tipo de rota × nível de desconto.
  // Volumes representativos de cada nível: 15 (5%), 30 (10%) e 80 (15%).
  test.each`
    peso   | origem  | destino | volumes | desconto | esperado
    ${5}   | ${'SP'} | ${'SP'} | ${15}   | ${0.05}  | ${26.6}
    ${5}   | ${'SP'} | ${'MG'} | ${15}   | ${0.05}  | ${37.24}
    ${5}   | ${'SP'} | ${'BA'} | ${15}   | ${0.05}  | ${50.54}
    ${30}  | ${'SP'} | ${'SP'} | ${15}   | ${0.05}  | ${63.84}
    ${30}  | ${'SP'} | ${'MG'} | ${15}   | ${0.05}  | ${89.38}
    ${30}  | ${'SP'} | ${'BA'} | ${15}   | ${0.05}  | ${121.3}
    ${75}  | ${'SP'} | ${'SP'} | ${15}   | ${0.05}  | ${117.04}
    ${75}  | ${'SP'} | ${'MG'} | ${15}   | ${0.05}  | ${163.86}
    ${75}  | ${'SP'} | ${'BA'} | ${15}   | ${0.05}  | ${222.38}
    ${150} | ${'SP'} | ${'SP'} | ${15}   | ${0.05}  | ${191.52}
    ${150} | ${'SP'} | ${'MG'} | ${15}   | ${0.05}  | ${268.13}
    ${150} | ${'SP'} | ${'BA'} | ${15}   | ${0.05}  | ${363.89}
    ${5}   | ${'SP'} | ${'SP'} | ${30}   | ${0.1}   | ${25.2}
    ${5}   | ${'SP'} | ${'MG'} | ${30}   | ${0.1}   | ${35.28}
    ${5}   | ${'SP'} | ${'BA'} | ${30}   | ${0.1}   | ${47.88}
    ${30}  | ${'SP'} | ${'SP'} | ${30}   | ${0.1}   | ${60.48}
    ${30}  | ${'SP'} | ${'MG'} | ${30}   | ${0.1}   | ${84.67}
    ${30}  | ${'SP'} | ${'BA'} | ${30}   | ${0.1}   | ${114.91}
    ${75}  | ${'SP'} | ${'SP'} | ${30}   | ${0.1}   | ${110.88}
    ${75}  | ${'SP'} | ${'MG'} | ${30}   | ${0.1}   | ${155.23}
    ${75}  | ${'SP'} | ${'BA'} | ${30}   | ${0.1}   | ${210.67}
    ${150} | ${'SP'} | ${'SP'} | ${30}   | ${0.1}   | ${181.44}
    ${150} | ${'SP'} | ${'MG'} | ${30}   | ${0.1}   | ${254.02}
    ${150} | ${'SP'} | ${'BA'} | ${30}   | ${0.1}   | ${344.74}
    ${5}   | ${'SP'} | ${'SP'} | ${80}   | ${0.15}  | ${23.8}
    ${5}   | ${'SP'} | ${'MG'} | ${80}   | ${0.15}  | ${33.32}
    ${5}   | ${'SP'} | ${'BA'} | ${80}   | ${0.15}  | ${45.22}
    ${30}  | ${'SP'} | ${'SP'} | ${80}   | ${0.15}  | ${57.12}
    ${30}  | ${'SP'} | ${'MG'} | ${80}   | ${0.15}  | ${79.97}
    ${30}  | ${'SP'} | ${'BA'} | ${80}   | ${0.15}  | ${108.53}
    ${75}  | ${'SP'} | ${'SP'} | ${80}   | ${0.15}  | ${104.72}
    ${75}  | ${'SP'} | ${'MG'} | ${80}   | ${0.15}  | ${146.61}
    ${75}  | ${'SP'} | ${'BA'} | ${80}   | ${0.15}  | ${198.97}
    ${150} | ${'SP'} | ${'SP'} | ${80}   | ${0.15}  | ${171.36}
    ${150} | ${'SP'} | ${'MG'} | ${80}   | ${0.15}  | ${239.9}
    ${150} | ${'SP'} | ${'BA'} | ${80}   | ${0.15}  | ${325.58}
  `('$peso kg, $origem → $destino, $volumes volumes: desconto $desconto, custa R$ $esperado', async ({ peso, origem, destino, volumes, desconto, esperado }) => {
    const { corpo } = await api.criar('v2', api.novaCotacao(peso, origem, destino, volumes));

    expect(corpo.desconto).toBe(desconto);
    expect(corpo.valor_total).toBe(esperado);
  });
});
