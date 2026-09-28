// Sobe a v1 e a v2 em processos separados antes dos testes.
// Se V1_URL ou V2_URL estiverem definidas, usa o ambiente já no ar em vez de subir
// uma instância local. Nos dois casos, confere se o endereço responde a versão certa.

const { spawn } = require('node:child_process');
const path = require('node:path');

const RAIZ_DO_PROJETO = path.resolve(__dirname, '..', '..');
const PORTAS_LOCAIS = { v1: 4101, v2: 4102 };

async function esperarVersao(url, versao) {
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    let resposta;
    try {
      resposta = await (await fetch(`${url}/api/versao`)).json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100)); // ainda subindo
      continue;
    }
    if (resposta.versao !== versao) {
      throw new Error(`${url} responde a versão ${resposta.versao}, e não a ${versao}`);
    }
    return;
  }
  throw new Error(`${url} não respondeu em 5 segundos`);
}

module.exports = async () => {
  globalThis.servidoresLocais = [];

  for (const versao of ['v1', 'v2']) {
    const variavel = `${versao.toUpperCase()}_URL`;
    if (!process.env[variavel]) {
      const porta = PORTAS_LOCAIS[versao];
      const processo = spawn(process.execPath, ['-e', `require('./server.js').createServer(${porta}, '${versao}')`], {
        cwd: RAIZ_DO_PROJETO,
        stdio: 'ignore',
      });
      globalThis.servidoresLocais.push(processo);
      process.env[variavel] = `http://localhost:${porta}`;
    }
    await esperarVersao(process.env[variavel], versao);
  }
};
