import { readFile } from 'node:fs/promises';

export type PortraitClassMap = Map<string, Set<string>>;

/**
 * Lê common/portrait_sets/ssm_portrait_sets.txt (fonte da verdade do próprio
 * mod, não da instalação vanilla) e monta portrait -> conjunto de
 * species_class. A maioria dos portraits mapeia pra uma única classe; alguns
 * (ex.: ssm_necron, ssm_green_elves) aparecem em mais de um portrait_set e
 * ficam ambíguos, exigindo species_class explícito na entrada de species_names.
 */
export async function loadPortraitClassMap(
  portraitSetsPath: string
): Promise<PortraitClassMap> {
  const txt = await readFile(portraitSetsPath, 'utf-8');
  const map: PortraitClassMap = new Map();

  const blockRe =
    /\w+\s*=\s*\{\s*species_class\s*=\s*(\w+)\s*portraits\s*=\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(txt))) {
    const [, speciesClass, portraitsBlock] = match;
    const portraits = [...portraitsBlock.matchAll(/"([^"]+)"/g)].map(
      (m) => m[1]!
    );
    for (const portrait of portraits) {
      if (!map.has(portrait)) map.set(portrait, new Set());
      map.get(portrait)!.add(speciesClass!);
    }
  }

  return map;
}

export function resolveSpeciesClass(
  portrait: string,
  override: string | undefined,
  map: PortraitClassMap,
  context: string
): { value?: string; error?: string } {
  const classes = map.get(portrait);

  if (!classes || classes.size === 0) {
    return {
      error: `[${context}] portrait "${portrait}" não existe em ssm_portrait_sets.txt.`,
    };
  }

  if (classes.size === 1) {
    return { value: [...classes][0] };
  }

  if (!override) {
    return {
      error: `[${context}] portrait "${portrait}" é ambíguo (${[
        ...classes,
      ].join(
        ', '
      )}) — informe "species_class" explicitamente pra essa entrada.`,
    };
  }

  if (!classes.has(override)) {
    return {
      error: `[${context}] species_class "${override}" inválido pro portrait "${portrait}" (opções válidas: ${[
        ...classes,
      ].join(', ')}).`,
    };
  }

  return { value: override };
}
