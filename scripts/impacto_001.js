// Compara o valor_base de cada cotação na v1, que segue a tabela do README, e na v2.
// Para as que diferem, recalcula o valor da v2 com a base da v1, mantendo o multiplicador
// e o desconto que a v2 aplicou. A diferença é o que a faixa errada sozinha cobra a mais.

const V1 = 'http://localhost:3001';
const V2 = 'http://localhost:3002';

// A listagem da v2 não traz valor_base nem desconto, então busca o detalhe de cada cotação.
async function detalhes(base) {
  const lista = await (await fetch(`${base}/api/cotacoes?limit=1000`)).json();
  return Promise.all(lista.itens.map(async (c) => (await fetch(`${base}/api/cotacoes/${c.id}`)).json()));
}

function valorFinal(valorBase, multiplicador, desconto) {
  return Math.round(valorBase * multiplicador * 1.12 * (1 - desconto) * 100) / 100;
}

function reais(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function main() {
  const v1 = await detalhes(V1);
  const v2 = await detalhes(V2);

  let total = 0;
  const linhas = [];
  for (const cotacao of v2) {
    const naV1 = v1.find((c) => c.id === cotacao.id);
    if (cotacao.valor_base === naV1.valor_base) continue;

    const diferenca = valorFinal(cotacao.valor_base, cotacao.multiplicador, cotacao.desconto)
      - valorFinal(naV1.valor_base, cotacao.multiplicador, cotacao.desconto);
    total += diferenca;
    linhas.push(`  cotação ${cotacao.id}: ${cotacao.peso_kg} kg → base de ${naV1.valor_base} para ${cotacao.valor_base} → ${reais(diferenca)} a mais`);
  }

  console.log(`Cotações com a faixa errada na v2: ${linhas.length} de ${v2.length}`);
  console.log(linhas.join('\n'));
  console.log(`Total cobrado a mais: ${reais(total)}`);
}

main();
