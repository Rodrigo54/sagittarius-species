import { gerarPortraits } from './generate-portraits';

const main = async () => {
  console.log('Processando Portraits');
  await gerarPortraits();
};

main().then(() => console.log('Fim'));
