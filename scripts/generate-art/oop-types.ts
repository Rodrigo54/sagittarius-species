/** Vocabulário estrutural dos nodes "ComfyUI OOP" (`custom_nodes/ComfyUI-OOP`,
 * https://github.com/0xRavenBlack/ComfyUI-OOP) usados pelo workflow
 * `scripts/comfyui/ssm_species_portrait_workflow.json`. Cada `const` abaixo é
 * a lista exata de opções do combo do node correspondente, extraída via
 * `GET /object_info/<Node>` na instância local do ComfyUI — não são valores
 * inventados, são os literais que a API aceita. O tipo union de cada campo é
 * derivado do próprio array (`typeof X[number]`), então lista de runtime e
 * tipo de compilação nunca divergem. `" "` (espaço) é o valor "nenhum",
 * default de vários combos opcionais no node original — mantido aqui porque é
 * um valor aceito de verdade pela API, não um placeholder nosso. */

export const OOP_GENEROS = ['Female', 'Male', 'Androgynous'] as const;
export type OOPGenero = (typeof OOP_GENEROS)[number];

export const OOP_FORMAS_CORPO = [
  'Slim', 'Athletic', 'Average', 'Curvy', 'Chubby', 'Hourglass', 'Muscular',
] as const;
export type OOPFormaCorpo = (typeof OOP_FORMAS_CORPO)[number];

export const OOP_ETNIAS = ['African', 'Asian', 'Caucasian', 'Latino', 'Pacific', 'Alien'] as const;
export type OOPEtnia = (typeof OOP_ETNIAS)[number];

export const OOP_ESTILOS_CABELO = [
  'Short', 'Long', 'Curly', 'Straight', 'Wavy', 'Bald', 'Ponytail', 'Braided', 'Bun', 'Spiky', 'Undercut',
] as const;
export type OOPEstiloCabelo = (typeof OOP_ESTILOS_CABELO)[number];

export const OOP_CORES_CABELO = [
  ' ', 'Black', 'Brown', 'Blonde', 'Red', 'White', 'Gray', 'Blue', 'Green', 'Pink', 'Purple', 'Orange',
  'Yellow', 'Teal', 'Cyan', 'Magenta', 'Maroon', 'Turquoise', 'Lavender', 'Beige', 'Gold', 'Silver',
  'Bronze', 'Copper', 'Indigo', 'Violet', 'Lilac', 'Burgundy', 'Olive', 'Peach', 'Coral', 'Mint', 'Azure',
  'Amber', 'Charcoal', 'Navy', 'Sky Blue', 'Lime', 'Mustard', 'Rose', 'Periwinkle', 'Salmon', 'Emerald',
  'Sapphire', 'Ruby', 'Platinum',
] as const;
export type OOPCorCabelo = (typeof OOP_CORES_CABELO)[number];

export const OOP_FORMAS_OLHO = [
  'Round', 'Almond', 'Hooded', 'Monolid', 'Upturned', 'Downturned', 'Oval', 'Closed',
] as const;
export type OOPFormaOlho = (typeof OOP_FORMAS_OLHO)[number];

export const OOP_CORES_OLHO = ['Blue', 'Green', 'Brown', 'Hazel', 'Gray', 'Amber', 'Violet'] as const;
export type OOPCorOlho = (typeof OOP_CORES_OLHO)[number];

export const OOP_FORMAS_BOCA = [
  'Round', 'Wide', 'Thin', 'Full', 'Heart', 'Smile', 'Frown', 'Neutral', 'Angled', 'Downturned', 'Oval',
  'Pointed', 'Pout', 'Curved', 'Smirk', 'Straight', 'Upturned', 'Chiseled', 'Wide Smile', 'Drooping',
] as const;
export type OOPFormaBoca = (typeof OOP_FORMAS_BOCA)[number];

export const OOP_TAMANHOS_BOCA = [
  ' ', 'Small', 'Medium', 'Large', 'Tiny', 'Huge', 'Petite', 'Gigantic',
] as const;
export type OOPTamanhoBoca = (typeof OOP_TAMANHOS_BOCA)[number];

export const OOP_ABERTURAS_BOCA = [
  ' ', 'Closed', 'Slightly', 'Wide', 'Open', 'Partially Open', 'Fully Open', 'Gaping', 'Barely Open',
] as const;
export type OOPAberturaBoca = (typeof OOP_ABERTURAS_BOCA)[number];

export const OOP_TIPOS_ROUPA_SUPERIOR = [
  'Nude', 'TShirt', 'Sweater', 'Jacket', 'Shirt', 'Blouse', 'Hoodie', 'Coat', 'TankTop', 'Vest',
  'Cardigan', 'Poncho', 'Kimono', 'Polo', 'ButtonDown', 'CropTop', 'Jumper', 'Raincoat', 'Parka',
] as const;
export type OOPTipoRoupaSuperior = (typeof OOP_TIPOS_ROUPA_SUPERIOR)[number];

export const OOP_TIPOS_ROUPA_INFERIOR = [
  'Nude', 'Jeans', 'Shorts', 'Skirt', 'Trousers', 'Leggings', 'Sweatpants', 'Cargo Pants', 'Chinos',
  'Dress', 'Short Skirt', 'Overalls', 'Capri Pants', 'Joggers', 'Palazzo Pants', 'Dungarees', 'Culottes',
  'Mini Skirt', 'Maxi Skirt',
] as const;
export type OOPTipoRoupaInferior = (typeof OOP_TIPOS_ROUPA_INFERIOR)[number];

export const OOP_CORES_ROUPA = [
  ' ', 'Black', 'White', 'Gray', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Brown', 'Beige', 'Orange',
] as const;
export type OOPCorRoupa = (typeof OOP_CORES_ROUPA)[number];

export const OOP_POSES_BASE = [
  'Sitting', 'Stand', 'Squat', 'Grovel', 'Lie', 'Jump', 'Run', 'Walk', 'Fly', 'HeadTilt', 'LookingBack',
  'LookingDown', 'LookingUp', 'Smelling', 'Sleeping', 'Bathing', 'AimingAtViewer', 'Stretching',
  'HandsOnHips', 'BreastsRestOnTable', 'HugFromBehind', 'LeaningForward', 'Selfie',
] as const;
export type OOPPoseBase = (typeof OOP_POSES_BASE)[number];

export const OOP_POSES_MAO = [
  'HandToMouth', 'ArmAtSide', 'ArmsBehindHead', 'ArmsBehindBack', 'HandOnOwnChest', 'ArmsCrossed',
  'HandOnHips', 'HandOnHip', 'HandsUp', 'Stretch', 'Armpits', 'LegHold', 'Grabbing', 'Holding',
  'Fingersmile', 'HairPull', 'HairScrunchie', 'PeaceSymbol', 'Salute', 'ThumbsUp', 'MiddleFinger',
  'CatPose', 'FingerGun', 'Waving', 'SpreadArms',
] as const;
export type OOPPoseMao = (typeof OOP_POSES_MAO)[number];

export const OOP_POSES_PERNA = [
  'SpreadLegs', 'CrossedLegs', 'FetalPosition', 'LegLift', 'LegsUp', 'LeaningForward', 'AgainstWall',
  'OnStomach', 'Seiza', 'WarizaWSitting', 'Yokozuwari', 'IndianStyle', 'LegHug', 'Straddling', 'Kneeling',
  'ArmSupport', 'FeetUp', 'OneKnee', 'StandingOnOneLeg', 'KneesUp',
] as const;
export type OOPPosePerna = (typeof OOP_POSES_PERNA)[number];

export const OOP_ESTILOS = [
  ' ', 'PhotoRAW', 'Abstract', 'BlackAndWhite', 'Vintage', 'Minimalist', 'PopArt', 'Watercolor',
  'OilPainting', 'Sketch', 'Cartoon', 'Impressionist', 'Surrealist', 'Realistic', 'Futuristic',
  'Cyberpunk', 'Gothic', 'Grunge', 'FilmNoir', 'ArtDeco', 'Modernist', 'Boho', 'PaperCut', 'Neon',
  'Retro', 'Lomo', 'PixelArt', 'Glitch', '3DRendering', 'HDR', 'Fantasy', 'StreetPhotography',
] as const;
export type OOPEstilo = (typeof OOP_ESTILOS)[number];

export const OOP_ANGULOS_VISTA = [
  'Normal', 'High', 'Low', 'Upward', 'Downward', 'Side', 'Tilted', 'Diagonal', 'EyeLevel',
  "Bird's Eye", "Worm's Eye", 'Dutch Angle', 'Overhead',
] as const;
export type OOPAnguloVista = (typeof OOP_ANGULOS_VISTA)[number];

export const OOP_TIPOS_VISTA = [
  'Closeup', 'Portrait', 'FullBody', 'Landscape', 'Panorama', 'WideAngle', 'Macro', 'MediumShot',
  'LongShot', 'Establishing', 'Aerial', 'Profile', 'ActionShot', 'Over-the-Shoulder', 'Extreme Closeup',
] as const;
export type OOPTipoVista = (typeof OOP_TIPOS_VISTA)[number];

export interface OOPCamposPessoa {
  age?: number;
  body_shape?: OOPFormaCorpo;
  ethnicity?: OOPEtnia;
  gender?: OOPGenero;
}

export interface OOPCamposCabelo {
  style?: OOPEstiloCabelo;
  main_color?: OOPCorCabelo;
  optional_color?: OOPCorCabelo;
}

export interface OOPCamposOlhos {
  shape?: OOPFormaOlho;
  color?: OOPCorOlho;
}

export interface OOPCamposBoca {
  shape?: OOPFormaBoca;
  size?: OOPTamanhoBoca;
  opening?: OOPAberturaBoca;
}

export interface OOPCamposRoupa {
  upper_type?: OOPTipoRoupaSuperior;
  lower_type?: OOPTipoRoupaInferior;
  upper_color?: OOPCorRoupa;
  lower_color?: OOPCorRoupa;
}

export interface OOPCamposPose {
  base_pose?: OOPPoseBase;
  hand_pose?: OOPPoseMao;
  leg_pose?: OOPPosePerna;
}

export interface OOPCamposEstilo {
  base_style?: OOPEstilo;
  second_style?: OOPEstilo;
}

export interface OOPCamposVista {
  angle?: OOPAnguloVista;
  viewType?: OOPTipoVista;
  backgroundBlur?: boolean;
}

/** Um bloco de atributos — usado tanto pra `base` quanto pra cada
 * `variante`, sempre como *overrides parciais* mesclados por seção (nunca o
 * objeto inteiro substituído). `extra` é o único campo de texto livre: entra
 * concatenado com o `STRING` composto pelo `OOPNode`, pra cobrir o que os
 * combos estruturados não expressam (expressão facial, direção do olhar,
 * instruções de composição). */
export interface OOPCamposCompostos {
  person?: OOPCamposPessoa;
  hair?: OOPCamposCabelo;
  eyes?: OOPCamposOlhos;
  mouth?: OOPCamposBoca;
  clothing?: OOPCamposRoupa;
  pose?: OOPCamposPose;
  style?: OOPCamposEstilo;
  view?: OOPCamposVista;
  extra?: string;
}

/** Bloco de um gênero (`male`/`female`/`flat`): overrides sobre `base`, mais
 * uma variante nomeada por indivíduo — a chave é o índice zero-padded a 3
 * dígitos (`"001"`..`"NNN"`), mesma convenção dos arquivos PNG finais. O
 * número de chaves precisa bater exatamente com `counts.<genero>` do
 * `portrait.json` (validado em `validation.ts`). */
export interface GeracaoArtGenero extends OOPCamposCompostos {
  variantes: Record<string, OOPCamposCompostos>;
  /** Caminho (relativo à raiz do repo) da imagem de referência **deste
   * gênero** — usada tanto pro img2img (`VAEEncode` da referência
   * redimensionada, ver `GeracaoArtModelo.denoise`) quanto pro ControlNet
   * OpenPose (esqueleto extraído dela). Uma por gênero, não uma por espécie:
   * macho e fêmea da mesma espécie normalmente têm poses/enquadramentos de
   * referência diferentes (arte legada de cada um). O `generate-art` envia
   * esse arquivo pro ComfyUI antes de enfileirar
   * (`enviarImagemDeReferencia`), já que o `LoadImage` só lê do `input/` do
   * próprio ComfyUI. */
  referenceImage?: string;
}

/** Configuração do checkpoint/sampler — fora dos nodes OOP (não é
 * vocabulário do ComfyUI-OOP, é o `CheckpointLoaderSimple`/`KSampler` do
 * workflow). Registrada aqui, por espécie, em vez de só editada no
 * template compartilhado (`scripts/comfyui/ssm_species_portrait_workflow.json`)
 * — a escolha de modelo é decisão de conteúdo por espécie, não um detalhe de
 * infraestrutura escondido. Campos ausentes mantêm o valor já presente no
 * template (não têm "padrão" próprio aqui). */
export interface GeracaoArtModelo {
  /** Nome do arquivo em `models/checkpoints/` do ComfyUI local. */
  checkpoint?: string;
  steps?: number;
  cfg?: number;
  sampler_name?: string;
  scheduler?: string;
  /** Dimensões pra que a referência (`GeracaoArtGenero.referenceImage`) é
   * redimensionada antes do `VAEEncode` — checkpoints SDXL pedem resolução
   * maior que SD1.5 (ex. ~832x1216 em vez de 512x768). */
  width?: number;
  height?: number;
  /** Força do denoise no `KSampler` pro img2img (0-1; 1.0 = ignora a
   * referência por completo, equivalente a txt2img; valores baixos tipo
   * 0.3-0.5 colam demais na referência e travam a variação entre
   * indivíduos). Ausente mantém o valor do template. */
  denoise?: number;
  /** Força do ControlNet (0-10, node aceita esse intervalo; 1.0 = padrão do
   * node). Ausente mantém o valor do template. Só tem efeito quando o
   * gênero em geração declara `referenceImage` (ver
   * `GeracaoArtGenero.referenceImage`) — sem isso o `generate-art` zera a
   * força pra não aplicar a imagem de exemplo do template. */
  controlNetStrength?: number;
  /** Nome do arquivo em `models/loras/` do ComfyUI local (ex.:
   * `PerfectEyesXL.safetensors` — a variante XL, compatível com checkpoints
   * SDXL como o `mahuaXLTurbo_v20`; existe também uma `Perfect_Eyes.safetensors`
   * pra SD1.5, não usar com checkpoint SDXL). Ausente mantém o LoRA do
   * template. */
  lora?: string;
  /** Força do LoRA no modelo e no CLIP (o node aceita valores negativos,
   * mas normalmente fica entre 0 e 1.5). Ausente mantém o valor do
   * template. Aplica o mesmo valor pros dois — não há necessidade
   * observada até agora de diferenciar `strength_model`/`strength_clip`. */
  loraStrength?: number;
}

export interface GeracaoArt {
  base: OOPCamposCompostos;
  modelo?: GeracaoArtModelo;
  male?: GeracaoArtGenero;
  female?: GeracaoArtGenero;
  flat?: GeracaoArtGenero;
}
