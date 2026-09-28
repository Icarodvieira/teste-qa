// Compara o valor que a v2 devolve com o valor calculado pela regra do README, usando a base,
// o multiplicador e o desconto que a própria v2 aplicou. A diferença é só do arredondamento.

const V2 = 'http://localhost:3002';

function valorFinal(valorBase, multiplicador, desconto) {
  return Math.round(valorBase * multiplicador * 1.12 * (1 - desconto) * 100) / 100;
}

function reais(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function main() {
  const lista = (await (await fetch(`${V2}/api/cotacoes?limit=1000`)).json()).itens;

  let afetadas = 0;
  let total = 0;
  for (const item of lista) {
    const cotacao = await (await fetch(`${V2}/api/cotacoes/${item.id}`)).json();
    const diferenca = valorFinal(cotacao.valor_base, cotacao.multiplicador, cotacao.desconto) - cotacao.valor_total;
    if (diferenca === 0) continue;

    afetadas++;
    total += diferenca;
  }

  console.log(`Cotações cobradas a menos na v2: ${afetadas} de ${lista.length}`);
  console.log(`Total cobrado a menos: ${reais(total)}`);
}

main();
