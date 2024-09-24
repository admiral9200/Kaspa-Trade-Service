import { AppConfigService } from 'src/modules/core/modules/config/app-config.service';
import { createCipheriv, createDecipheriv, scrypt } from 'crypto';
import { Injectable } from '@nestjs/common';
import { promisify } from 'util';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';

  constructor(private readonly config: AppConfigService) {}

  async encrypt(text: string): Promise<string> {
    const configKeys = this.config.encryptionKeys;

    const key = (await promisify(scrypt)(
      configKeys.KEY_32,
      'salt',
      32,
    )) as Buffer;
    const cipher = createCipheriv(this.algorithm, key, configKeys.KEY_16);

    const encryptedText = Buffer.concat([cipher.update(text), cipher.final()]);

    return encryptedText.toString('hex');
  }

  async decrypt(encryptedData: string): Promise<string> {
    const configKeys = this.config.encryptionKeys;

    const key = (await promisify(scrypt)(
      configKeys.KEY_32,
      'salt',
      32,
    )) as Buffer;

    const encryptedDataBuffer = Buffer.from(encryptedData, 'hex');

    const decipher = createDecipheriv(this.algorithm, key, configKeys.KEY_16);
    const decryptedText = Buffer.concat([
      decipher.update(encryptedDataBuffer),
      decipher.final(),
    ]);

    return decryptedText.toString();
  }
}
