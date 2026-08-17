export type DescriptorMod = {
  name: string;
  version: string;
  remoteFileId: string;
};

const REGEX_CAMPOS = {
  name: /^name\s*=\s*"([^"]*)"/m,
  version: /^version\s*=\s*"([^"]*)"/m,
  remoteFileId: /^remote_file_id\s*=\s*"([^"]*)"/m,
} as const;

/** Extrai os campos que o publish precisa de um `descriptor.mod` (formato Clausewitz). Só os três
 * campos usados aqui — não é um parser genérico do formato (ver `docs/pipeline-nomes.md`/jomini
 * pros casos que precisam disso de verdade). */
export function parseDescriptorMod(conteudo: string): DescriptorMod {
  const extrair = (regex: RegExp, campo: string): string => {
    const match = regex.exec(conteudo);
    if (!match) {
      throw new Error(`descriptor.mod não tem o campo "${campo}" esperado`);
    }
    return match[1]!;
  };

  return {
    name: extrair(REGEX_CAMPOS.name, 'name'),
    version: extrair(REGEX_CAMPOS.version, 'version'),
    remoteFileId: extrair(REGEX_CAMPOS.remoteFileId, 'remote_file_id'),
  };
}
