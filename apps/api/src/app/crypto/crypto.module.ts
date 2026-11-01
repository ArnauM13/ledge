import { Logger, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { loadKeyring } from './master-key';

/**
 * Loads the master key when the API starts. A missing or invalid key throws
 * here, so the application never starts without it. The error message names
 * the variable and the problem, never the key.
 */
@Module({
  providers: [
    {
      provide: EncryptionService,
      useFactory: (): EncryptionService => {
        const keyring = loadKeyring();
        new Logger('Crypto').log(
          `Master key loaded (current version ${keyring.currentVersion}, versions: ${keyring.versions.join(', ')})`,
        );
        return new EncryptionService(keyring);
      },
    },
  ],
  exports: [EncryptionService],
})
export class CryptoModule {}
