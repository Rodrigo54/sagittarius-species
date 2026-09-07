import { CATEGORIA_DA_CLASSE, CATEGORIAS_TEMATICAS, type CategoriaId, type SpeciesClassId } from '../shared/stellaris';
import { GATE_DA_CLASSE, SET_DA_CLASSE, SET_ROBOT_DERIVADO } from './vocabulario';

/** `ROBOT` nunca é declarada num `portrait.json` (ver `SET_ROBOT_DERIVADO`),
 * então só existe como `species_class` de um `SetDerivado` — nunca dentro de
 * `Filiacao.species_classes`, que continua fechado em `SpeciesClassId`. */
type SpeciesClassDoSet = SpeciesClassId | 'ROBOT';

/** A filiação declarada por uma espécie, já lida do `portrait.json`. */
export interface Filiacao {
  slug: string;
  species_classes: SpeciesClassId[];
  categories: CategoriaId[];
}

/** Uma linha dentro de `randomizable`/`playable`. Três formas, todas com
 * precedente vanilla: o trigger direto (`has_infernals = yes`), o `OR` de
 * vários (quando a espécie tem duas classes preferidas), e o `always = no`
 * que desliga o eixo. */
export type LinhaTrigger =
  | { tipo: 'trigger'; trigger: string; valor: 'yes' | 'no' }
  | { tipo: 'always'; valor: 'yes' | 'no' };

/** Uma espécie dentro de um set. Os dois eixos são independentes:
 * `randomizable` decide o que impérios de IA podem sortear, `playable` o que
 * aparece no editor de império. Ambos vazios = a espécie entra na lista
 * `portraits` incondicional do set. */
export interface EntradaDeSet {
  slug: string;
  randomizable: LinhaTrigger[];
  playable: LinhaTrigger[];
}

export interface SetDerivado {
  nome: string;
  species_class: SpeciesClassDoSet;
  /** Categorias em que este set aparece, sem a guarda-chuva. */
  categorias: CategoriaId[];
  /** Se este set entra na categoria guarda-chuva do mod.
   *
   * O jogo **deduplica** um retrato repetido entre sets dentro de uma aba e
   * fica com a **primeira ocorrência**, na ordem em que os sets aparecem na
   * categoria — não com a mais permissiva. E `playable` falso não esconde a
   * célula: deixa cinza (é assim que o Stellaris expõe retrato de DLC que o
   * jogador não tem).
   *
   * Somando as duas coisas: se um set condicionado a DLC entrasse na aba do
   * mod junto com o set de fallback, quem não tivesse o DLC veria uma célula
   * cinza no lugar da espécie. Por isso a guarda-chuva recebe só os sets que
   * são a **última** opção de alguma espécie — os que estão sempre
   * disponíveis. As abas específicas (Aquatic, Infernal) continuam mostrando
   * a versão premium normalmente. */
  naGuardaChuva: boolean;
  entradas: EntradaDeSet[];
}

/** As categorias que este set carrega: a espelhada da própria classe (quando a
 * espécie a declarou) mais todas as temáticas declaradas. A categoria
 * espelhada das **outras** classes da espécie fica de fora — é o set daquela
 * outra classe que a serve. */
function categoriasDoSet(classe: SpeciesClassId, declaradas: CategoriaId[]): CategoriaId[] {
  const espelhada = CATEGORIA_DA_CLASSE[classe];
  return declaradas.filter(
    (categoria) => categoria === espelhada || CATEGORIAS_TEMATICAS.includes(categoria)
  );
}

/** Os gates das classes preferidas (as anteriores na lista) que têm gate. */
function gatesPreferidos(classes: SpeciesClassId[], indice: number): string[] {
  return classes
    .slice(0, indice)
    .map((classe) => GATE_DA_CLASSE[classe])
    .filter((gate): gate is string => gate !== undefined);
}

/** Condição da via **principal**: o gate desta classe afirmado, e o de cada
 * classe preferida negado — a espécie só cai para cá quando o jogador não tem
 * o DLC das anteriores. */
function condicaoPrincipal(classes: SpeciesClassId[], indice: number): LinhaTrigger[] {
  const linhas: LinhaTrigger[] = gatesPreferidos(classes, indice).map((gate) => ({
    tipo: 'trigger',
    trigger: gate,
    valor: 'no',
  }));

  const gateAtual = GATE_DA_CLASSE[classes[indice]!];
  if (gateAtual !== undefined) linhas.push({ tipo: 'trigger', trigger: gateAtual, valor: 'yes' });

  return linhas;
}

/** O que o **editor de império** oferece. Na última classe da lista — a que
 * está sempre disponível — a espécie é sempre escolhível: quem tem o DLC pode
 * querer a sereia humanoide de propósito, e condicionar aqui só deixaria a
 * célula cinza (`playable` falso não esconde, ver `SetDerivado.naGuardaChuva`).
 *
 * Nas classes anteriores, `playable` acompanha `randomizable`: sem o DLC, a
 * célula fica cinza na aba daquela classe, que é como o vanilla anuncia
 * retrato de DLC não comprado. */
function condicaoDeEditor(classes: SpeciesClassId[], indice: number, principal: LinhaTrigger[]): LinhaTrigger[] {
  const ehUltima = indice === classes.length - 1;
  const ehFallback = principal.some((linha) => linha.tipo === 'trigger' && linha.valor === 'no');
  if (!ehUltima || !ehFallback) return principal;
  return [{ tipo: 'always', valor: 'yes' }];
}

/** Nome do set: o nome canônico da classe, mais as categorias temáticas quando
 * a classe tem mais de um agrupamento principal. Uma classe com um grupo só
 * mantém o nome curto (`ssm_machine`), mesmo que o grupo tenha temáticas.
 *
 * `ROBOT` não tem agrupamento temático — é sempre um grupo só, sem categoria
 * nenhuma (ver `derivarSets`) — então resolve direto pro nome fixo. */
function nomeDoSet(classe: SpeciesClassDoSet, categorias: CategoriaId[], classeTemVariosGrupos: boolean): string {
  if (classe === 'ROBOT') return SET_ROBOT_DERIVADO;

  const base = SET_DA_CLASSE[classe];
  if (!classeTemVariosGrupos) return base;

  const tematicas = categorias.filter((categoria) => CATEGORIAS_TEMATICAS.includes(categoria));
  return tematicas.length === 0 ? base : `${base}_${tematicas.join('_')}`;
}

/** Uma espécie que declara uma classe **sem gate** antes do fim da lista torna
 * todas as classes seguintes inalcançáveis: a classe sem gate está sempre
 * disponível, então a negação que levaria à próxima nunca é verdadeira. É
 * quase certo um erro de ordem (`["HUM","AQUATIC"]` em vez de
 * `["AQUATIC","HUM"]`), então trava a geração em vez de emitir um set morto. */
function validarOrdem(filiacao: Filiacao): string[] {
  const { slug, species_classes } = filiacao;
  return species_classes.slice(0, -1).flatMap((classe, indice) =>
    GATE_DA_CLASSE[classe] === undefined
      ? [
          `${slug}: species_class "${classe}" (posição ${indice + 1}) não depende de DLC, então as classes ` +
            `seguintes (${species_classes.slice(indice + 1).join(', ')}) nunca seriam alcançadas — a classe sem ` +
            `DLC precisa ser a última da lista.`,
        ]
      : []
  );
}

/** Deriva os `portrait_sets` a partir da filiação declarada pelas espécies:
 * agrupa por `(species_class × categorias)`, resolve o nome de cada set e
 * calcula as condições de cada espécie dentro dele.
 *
 * Os dois eixos de uma entrada podem divergir: `randomizable` segue a ordem de
 * preferência declarada, `playable` libera a classe de fallback pra qualquer
 * jogador. Ver `condicaoDeEditor` e `SetDerivado.naGuardaChuva`.
 *
 * Devolve os erros em vez de lançar, pro chamador acumular tudo numa mensagem
 * só — mesmo padrão dos outros pipelines. */
export function derivarSets(especies: Filiacao[]): { sets: SetDerivado[]; erros: string[] } {
  const erros = especies.flatMap(validarOrdem);
  if (erros.length > 0) return { sets: [], erros };

  const grupos = new Map<string, SetDerivado>();

  for (const especie of especies) {
    especie.species_classes.forEach((classe, indice) => {
      const categorias = categoriasDoSet(classe, especie.categories);
      const principal = condicaoPrincipal(especie.species_classes, indice);
      const ehUltima = indice === especie.species_classes.length - 1;

      const chave = `${classe}|${[...categorias].sort().join(',')}`;
      const grupo = grupos.get(chave) ?? {
        nome: '',
        species_class: classe,
        categorias,
        naGuardaChuva: false,
        entradas: [],
      };

      grupo.entradas.push({
        slug: especie.slug,
        randomizable: principal,
        playable: condicaoDeEditor(especie.species_classes, indice, principal),
      });
      // Basta uma espécie ter este set como última opção pra ele estar sempre
      // disponível a alguém, e portanto poder representar o mod na aba própria.
      grupo.naGuardaChuva ||= ehUltima;
      grupos.set(chave, grupo);
    });

    // `ROBOT` é a species_class que o Stellaris atribui à espécie sintética
    // resultante da Ascensão Sintética (e a robôs construídos) — nunca
    // aparece na criação de império, só depois que a partida já começou (ver
    // `SET_ROBOT_DERIVADO`). Nenhuma espécie a declara: toda espécie `MACHINE`
    // entra automaticamente aqui também, incondicional e sem categoria — o
    // vanilla não tem aba nenhuma pra `ROBOT`, então não há guarda-chuva nem
    // `portrait_categories` pra atualizar.
    if (especie.species_classes.includes('MACHINE')) {
      const grupoRobot = grupos.get('ROBOT|') ?? {
        nome: '',
        species_class: 'ROBOT',
        categorias: [],
        naGuardaChuva: false,
        entradas: [],
      };
      grupoRobot.entradas.push({ slug: especie.slug, randomizable: [], playable: [] });
      grupos.set('ROBOT|', grupoRobot);
    }
  }

  const porClasse = Map.groupBy([...grupos.values()], (grupo) => grupo.species_class);
  for (const [, gruposDaClasse] of porClasse) {
    for (const grupo of gruposDaClasse) {
      grupo.nome = nomeDoSet(grupo.species_class, grupo.categorias, gruposDaClasse.length > 1);
    }
  }

  const sets = [...grupos.values()].sort(
    (a, b) => a.species_class.localeCompare(b.species_class) || a.nome.localeCompare(b.nome)
  );
  for (const set of sets) set.entradas.sort((a, b) => a.slug.localeCompare(b.slug));

  const nomesRepetidos = [...Map.groupBy(sets, (set) => set.nome)]
    .filter(([, mesmoNome]) => mesmoNome.length > 1)
    .map(([nome]) => nome);
  for (const nome of nomesRepetidos) {
    erros.push(
      `dois portrait_sets diferentes resolveram para o nome "${nome}" — grupos distintos da mesma ` +
        `species_class precisam diferir nas categorias temáticas.`
    );
  }

  return { sets, erros };
}
