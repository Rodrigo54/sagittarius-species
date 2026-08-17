import { describe, expect, test } from 'bun:test';
import { parseDescriptorMod } from './descriptor';

const DESCRIPTOR_VALIDO = `
name = "Sagittarius Species"
version = "1.9.0"
path = "mod/sagittarius-species"
tags = {
	"Species"
  "Graphics"
}
picture = "thumbnail.png"
supported_version = "v4.4.*"
remote_file_id = "3054793206"
`;

describe('parseDescriptorMod', () => {
  test('extrai name, version e remote_file_id', () => {
    expect(parseDescriptorMod(DESCRIPTOR_VALIDO)).toEqual({
      name: 'Sagittarius Species',
      version: '1.9.0',
      remoteFileId: '3054793206',
    });
  });

  test('lança erro claro se um campo esperado estiver faltando', () => {
    const semRemoteFileId = DESCRIPTOR_VALIDO.replace(/remote_file_id.*\n?/, '');
    expect(() => parseDescriptorMod(semRemoteFileId)).toThrow(/remote_file_id/);
  });
});
