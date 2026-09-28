module.exports = async () => {
  for (const processo of globalThis.servidoresLocais ?? []) processo.kill();
};
