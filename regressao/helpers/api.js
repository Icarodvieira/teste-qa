// Chamadas à API usadas pelos testes. A versão ('v1' ou 'v2') escolhe o endereço.

function endereco(versao) {
  return process.env[`${versao.toUpperCase()}_URL`];
}

async function chamar(versao, metodo, caminho, corpo) {
  const resposta = await fetch(`${endereco(versao)}${caminho}`, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: resposta.status, tipo: resposta.headers.get('content-type'), corpo: await resposta.json() };
}

function novaCotacao(peso_kg, uf_origem, uf_destino, volumes = 1) {
  return { cliente: 'Teste de regressão', peso_kg, volumes, uf_origem, uf_destino };
}

module.exports = {
  novaCotacao,
  versao: (versao) => chamar(versao, 'GET', '/api/versao'),
  reset: (versao) => chamar(versao, 'POST', '/_reset'),
  criar: (versao, dados) => chamar(versao, 'POST', '/api/cotacoes', dados),
  detalhe: (versao, id) => chamar(versao, 'GET', `/api/cotacoes/${id}`),
  listar: (versao, query = '') => chamar(versao, 'GET', `/api/cotacoes${query}`),
  faturar: (versao, id) => chamar(versao, 'POST', `/api/cotacoes/${id}/faturar`),
  faturas: (versao, query = '') => chamar(versao, 'GET', `/api/faturas${query}`),
};
