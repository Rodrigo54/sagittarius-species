import type { CamposCompostos } from '../portrait-schema';
import type { BaseFixo } from './base';

/** Composição de texto (enum→frase + concatenação, pesos de ênfase) é
 * agnóstica de motor de geração — o `CLIPTextEncode` do grafo Flux2 recebe
 * o `positive`/`negative` já pronto, sem compor nada internamente.
 *
 * Ordem fixa e determinística. Peso de ênfase (sintaxe A1111, `(texto:peso)`)
 * é usado com disciplina, não em tudo: **só nos dois atributos mais frágeis**
 * (`eyes.color`, `person.ethnicity` — área pequena do rosto). `eyes.color` é
 * uma frase curta (`comPeso`, ver abaixo); `person.ethnicity` é uma frase
 * descritiva combinando a palavra crua da etnia com traços de pele/rosto
 * (`TEXTO_ETNIA`, texto completo já com peso embutido). Peso moderado
 * (1.1–1.3 — acima disso já vazou pra atributo vizinho em testes reais).
 * Pra "distorção" (algo que o checkpoint insiste em gerar errado, tipo
 * tronco exposto ou aparência andrógina), o peso vai no **negativo** (o
 * oposto do que se quer, reforçado), não empilhando peso em cima de uma
 * frase positiva longa — ver `docs/history/2026-08-08-generate-art-schema-proprio.md`
 * pro caso real que motivou essa mudança de estratégia. */

/** Peso de ênfase — faixa 1.1–1.3, nunca fora dela. Usado tanto nas duas
 * âncoras positivas (`eyes.color`, `person.ethnicity`) quanto nas exclusões
 * estruturadas do negativo (oposto de `torso.state`/`person.gender`). */
const PESO = 1.2;

function comPeso(texto: string | undefined): string | undefined {
  return texto === undefined ? undefined : `(${texto}:${PESO})`;
}

function textoTipo(campos: CamposCompostos): string | undefined {
  const tipo = campos.tipo;
  if (!tipo) return undefined;
  return [tipo.value, tipo.description].filter((v): v is string => !!v).join(', ');
}

/** Traduz `torso.state` pra texto curto e afirmativo — sem peso e sem
 * frase longa/redundante (frase longa com peso alto foi tentado antes e não
 * resolveu sozinho; a exclusão correspondente no negativo, com peso, é o
 * que carrega o reforço agora — ver `NEGATIVO_ESTADO_TORSO`). Neutro:
 * nenhum estado é "melhor" que outro, só descreve o que a espécie precisa
 * mostrar. */
const TEXTO_ESTADO_TORSO: Record<NonNullable<CamposCompostos['torso']>['state'] & string, string> = {
  Bare: 'bare torso, no armor covering the chest or stomach',
  FullyCovered: 'torso fully covered by armor',
  ArmsCoveredTorsoBare: 'arms covered by armor, chest and stomach bare',
  TorsoCoveredArmsBare: 'chest and stomach covered by armor, arms bare',
  PartiallyCovered: 'torso partially covered',
};

function textoTorsoState(campos: CamposCompostos): string | undefined {
  const state = campos.torso?.state;
  return state ? TEXTO_ESTADO_TORSO[state] : undefined;
}

/** Contraparte negativa de `TEXTO_ESTADO_TORSO`, **com peso** — é aqui que
 * o reforço de verdade acontece agora (curto, no negativo), não numa frase
 * positiva longa. `PartiallyCovered` não tem entrada: estado ambíguo de
 * propósito, sem direção clara pra excluir. */
const NEGATIVO_ESTADO_TORSO: Partial<Record<NonNullable<CamposCompostos['torso']>['state'] & string, string>> = {
  Bare: 'chest armor, covered torso',
  FullyCovered: 'bare stomach, bare midriff, exposed abs, shirtless',
  ArmsCoveredTorsoBare: 'covered stomach, bare arms',
  TorsoCoveredArmsBare: 'bare stomach, covered arms',
};

function negativoTorsoState(campos: CamposCompostos): string | undefined {
  const state = campos.torso?.state;
  const texto = state ? NEGATIVO_ESTADO_TORSO[state] : undefined;
  return comPeso(texto);
}

/** Cor de olho — uma das duas únicas âncoras com peso (área pequena do
 * rosto, historicamente a mais frágil). Frase curta de propósito. */
function textoOlhosCor(campos: CamposCompostos): string | undefined {
  const cor = campos.eyes?.color;
  return cor ? comPeso(`${cor.toLowerCase()} eyes`) : undefined;
}

/** Etnia — a outra âncora com peso. Frase combinando a palavra crua da
 * etnia com traços descritivos de pele/rosto, na posição de prioridade alta
 * (mesma posição que antes só tinha a palavra crua) — texto completo já
 * inclui o peso, não passa por `comPeso`, porque o peso varia por etnia
 * (1.3 pras que precisam de reforço mais forte, 1.2 pras demais). */
const TEXTO_ETNIA: Record<NonNullable<CamposCompostos['person']>['ethnicity'] & string, string> = {
  African: '(African, dark skin, deep brown skin tone, African facial features:1.3)',
  Asian: '(Asian, light skin tone, East Asian facial features:1.3)',
  Pacific: '(Pacific, Pacific Islander or Southeast Asian facial features, tan skin tone:1.3)',
  Mixed: '(Mixed, European and Indigenous Brazilian ancestry or European and African Brazilian ancestry, brown skin tone:1.3)',
  Caucasian: '(Caucasian, fair skin tone, European facial features:1.2)',
  Latino: '(Latino, olive/tan skin tone, Latin American facial features:1.2)',
  Nordic: '(Nordic, fair skin tone, Scandinavian facial features:1.2)',
};

function textoEtniaAncora(campos: CamposCompostos): string | undefined {
  const etnia = campos.person?.ethnicity;
  return etnia ? TEXTO_ETNIA[etnia] : undefined;
}

const TEXTO_GENERO: Partial<Record<NonNullable<CamposCompostos['person']>['gender'] & string, string>> = {
  Male: 'man',
  Female: 'woman',
  Androgynous: 'androgynous person',
};

/** Contraparte negativa de gênero, **com peso** — mesma lógica de
 * `NEGATIVO_ESTADO_TORSO`: "distorção" (aparência andrógina indesejada)
 * combatida no negativo, não empilhando peso no positivo.
 * `Androgynous` não tem entrada: estado ambíguo por natureza. */
const NEGATIVO_GENERO: Partial<Record<NonNullable<CamposCompostos['person']>['gender'] & string, string>> = {
  Male: 'androgynous, feminine',
  Female: 'androgynous, masculine',
};

function negativoGenero(campos: CamposCompostos): string | undefined {
  const gender = campos.person?.gender;
  const texto = gender ? NEGATIVO_GENERO[gender] : undefined;
  return comPeso(texto);
}

/** Idade, gênero e físico combinados numa frase curta — sem peso (etnia já
 * saiu daqui, virou âncora). Mesmo estilo "keyword soup" do resto do
 * prompt. */
function textoPessoa(campos: CamposCompostos): string | undefined {
  const person = campos.person;
  if (!person) return undefined;

  const generoTexto = person.gender ? TEXTO_GENERO[person.gender] : undefined;

  const sujeito = [person.age !== undefined ? `${Math.round(person.age)}-year-old` : undefined, generoTexto]
    .filter((v): v is string => !!v)
    .join(' ');

  const corpo = person.body_shape ? `${person.body_shape.toLowerCase()} build` : undefined;

  return [sujeito || undefined, corpo].filter((v): v is string => !!v).join(', ') || undefined;
}

/** Cabelo — estilo e cor juntos, entre parênteses simples (sem `:número`,
 * ênfase leve implícita — ~1.1x na convenção A1111/ComfyUI). Cabelo se
 * mostrou tão frágil quanto olho/etnia nos testes reais (cor pedida saindo
 * errada em praticamente todo checkpoint testado pro `ssm_astral`), mas sem
 * subir pro grupo de peso explícito (`comPeso`, 1.1–1.3) — ênfase leve por
 * parênteses simples, não número. */
function textoCabelo(campos: CamposCompostos): string | undefined {
  const hair = campos.hair;
  if (!hair) return undefined;

  const principal = hair.main_color && hair.main_color !== ' ' ? hair.main_color.toLowerCase() : undefined;
  const estilo = hair.style ? hair.style.toLowerCase() : undefined;
  const secundaria = hair.optional_color && hair.optional_color !== ' ' ? hair.optional_color.toLowerCase() : undefined;

  const partesBase = [principal, estilo, 'hair'].filter((v): v is string => !!v);
  let texto = partesBase.length > 1 ? partesBase.join(' ') : undefined;
  if (secundaria) texto = texto ? `${texto} with ${secundaria} highlights` : `${secundaria} hair highlights`;
  return texto ? `(${texto})` : undefined;
}

/** Formato do olho — molde por valor, não mais um template único. `Upturned`/`Downturned` precisam de frase
 * dedicada: "<forma>-shaped eyes" genérico fazia a IA confundir o canto externo da pálpebra caído/puxado com o
 * OLHAR pra baixo/cima (sentido comum dessas palavras em inglês), contradizendo a expressão fixa de
 * `base.json` ("looking directly at the camera"). A frase é curta de propósito (evitar inflar o prompt só por
 * causa do olho, como as outras âncoras — `eyes.color`, `person.ethnicity`), mas cita "outer eye corners" +
 * "gaze forward" pra desambiguar. Não cita etnia nenhuma de propósito — `shape` e `ethnicity` são eixos
 * ortogonais no schema (dá pra combinar qualquer combinação; ex. `ssm_default` female/005 é `Caucasian` +
 * `Downturned`), amarrar o texto a um grupo étnico geraria contradição nesse tipo de variante. */
const TEXTO_FORMA_OLHO: Record<NonNullable<CamposCompostos['eyes']>['shape'] & string, string> = {
  Round: 'round-shaped eyes',
  Almond: 'almond-shaped eyes',
  Hooded: 'droopy eyelids, low eyelid crease',
  Monolid: 'monolid eyes, no visible eyelid crease',
  Oval: 'oval-shaped eyes',
  Closed: 'closed eyes',
  Upturned: 'upturned outer eye corners, gaze forward at the viewer',
  Downturned: 'downturned outer eye corners, gaze forward at the viewer',
};

function textoOlhosFormato(campos: CamposCompostos): string | undefined {
  const forma = campos.eyes?.shape;
  return forma ? TEXTO_FORMA_OLHO[forma] : undefined;
}

/** Contraparte negativa de `TEXTO_FORMA_OLHO`, **com peso** — só pros valores ambíguos (`Upturned`/`Downturned`,
 * confundidos com direção do olhar; `Hooded`, confundido com a peça de roupa "hood"/capuz), mesma lógica de
 * `NEGATIVO_ESTADO_TORSO`/`NEGATIVO_GENERO`: reforço de verdade no negativo, não empilhando peso numa frase
 * positiva longa. Central aqui (não só por espécie via `extra_prompt`) pra cobrir qualquer espécie futura que
 * use `Hooded` sem repetir essa exclusão manualmente. Os outros valores não têm entrada — não há "oposto"
 * ambíguo pra excluir. */
const NEGATIVO_FORMA_OLHO: Partial<Record<NonNullable<CamposCompostos['eyes']>['shape'] & string, string>> = {
  Upturned: 'looking up, gaze rolled upward, head tilted back',
  Downturned: 'looking down, downcast gaze, head tilted down',
  Hooded: 'hood, hoodie',
};

function negativoFormaOlho(campos: CamposCompostos): string | undefined {
  const forma = campos.eyes?.shape;
  const texto = forma ? NEGATIVO_FORMA_OLHO[forma] : undefined;
  return comPeso(texto);
}

function textoTorsoDescricao(campos: CamposCompostos): string | undefined {
  return campos.torso?.description;
}

/** Monta os dois prompts finais (positivo, negativo) a partir dos campos já
 * mesclados (`mesclarCampos`, base→gênero→variante) e dos valores fixos de
 * `base.json`. Ordem do positivo: estilo/qualidade (fixo, inclui termos
 * gerais tipo "masterpiece") → as duas âncoras com peso (eyes.color,
 * person.ethnicity) → tipo/pessoa/cabelo/olhos/torso (estruturado, curto,
 * sem peso) → pose/expressão/enquadramento (fixos) → extra_prompt.positive
 * (texto livre, sempre por último). Negativo: baseline compartilhado (fixo)
 * → exclusões estruturadas com peso (oposto de torso.state, oposto de
 * gênero, oposto de eyes.shape quando Upturned/Downturned) →
 * extra_prompt.negative (texto livre, por cima — quem escreve decide se usa
 * peso). */
export function montarPrompts(campos: CamposCompostos, baseFixo: BaseFixo): { positive: string; negative: string } {
  const fragmentosPositivos = [
    baseFixo.style,
    textoOlhosCor(campos),
    textoEtniaAncora(campos),
    textoTipo(campos),
    textoPessoa(campos),
    textoCabelo(campos),
    textoOlhosFormato(campos),
    textoTorsoState(campos),
    textoTorsoDescricao(campos),
    baseFixo.expression,
    baseFixo.pose,
    baseFixo.view,
    campos.extra_prompt?.positive,
  ].filter((v): v is string => !!v);

  const fragmentosNegativos = [
    baseFixo.negative,
    negativoTorsoState(campos),
    negativoGenero(campos),
    negativoFormaOlho(campos),
    campos.extra_prompt?.negative,
  ].filter((v): v is string => !!v);

  return {
    positive: fragmentosPositivos.join(', '),
    negative: fragmentosNegativos.join(', '),
  };
}
