// Filtra as cotações pelo número de volumes e soma o que a v2 cobra a mais por aplicar
// um desconto menor que o da SPEC. A conta usa a base de peso da v1, que segue o README,
// para não misturar com o bug 001.

const V1 = 'http://localhost:3001';
const V2 = 'http://localhost:3002';

async function detalhe(base, id) {
  return (await fetch(`${base}/api/cotacoes/${id}`)).json();
}

function valorFinal(valorBase, multiplicador, desconto) {
  return Math.round(valorBase * multiplicador * 1.12 * (1 - desconto) * 100) / 100;
}

function reais(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function medir(volumes, descontoDaSpec) {
  const lista = (await (await fetch(`${V2}/api/cotacoes?limit=1000`)).json()).itens;
  const cotacoes = lista.filter((c) => c.volumes === volumes);

  let total = 0;
  for (const cotacao of cotacoes) {
    const naV1 = await detalhe(V1, cotacao.id);
    const naV2 = await detalhe(V2, cotacao.id);
    total += valorFinal(naV1.valor_base, naV1.multiplicador, naV2.desconto)
      - valorFinal(naV1.valor_base, naV1.multiplicador, descontoDaSpec);
  }

  console.log(`${volumes} volumes: ${cotacoes.length} cotações, ${reais(total)} a mais`);
}

async function main() {
  await medir(20, 0.10);
  await medir(50, 0.15);
  await medir(10, 0.05);
}

main();
