// Optional offline backup encryption using Web Crypto only.
(function (root) {
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const iterations = 250000;
  async function digest(text, cryptoApi = globalThis.crypto) {
    const bytes = await cryptoApi.subtle.digest('SHA-256', encoder.encode(text));
    return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
  }
  async function withChecksum(data, cryptoApi = globalThis.crypto) {
    const body = { ...data };
    delete body.checksum;
    return { ...body, checksum: await digest(JSON.stringify(body), cryptoApi) };
  }
  async function verifyChecksum(data, cryptoApi = globalThis.crypto) {
    if (!data?.checksum) return false;
    const expected = data.checksum, body = { ...data };
    delete body.checksum;
    return expected === await digest(JSON.stringify(body), cryptoApi);
  }
  async function derive(passphrase, salt, cryptoApi) {
    const material = await cryptoApi.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return cryptoApi.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptBackup(data, passphrase, cryptoApi = globalThis.crypto) {
    if (!passphrase || passphrase.length < 8) throw new Error('Passphrase must be at least 8 characters.');
    const checked = await withChecksum(data, cryptoApi), salt = cryptoApi.getRandomValues(new Uint8Array(16)), iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const key = await derive(passphrase, salt, cryptoApi);
    const ciphertext = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(checked)));
    const hex = bytes => [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    return { app: 'Pocket Ledger', format: 'pocket-ledger-encrypted', version: 1, kdf: 'PBKDF2-SHA-256', iterations, cipher: 'AES-256-GCM', salt: hex(salt), iv: hex(iv), ciphertext: hex(new Uint8Array(ciphertext)) };
  }
  async function decryptBackup(envelope, passphrase, cryptoApi = globalThis.crypto) {
    if (!envelope || envelope.app !== 'Pocket Ledger' || envelope.format !== 'pocket-ledger-encrypted' || envelope.version !== 1) throw new Error('Unsupported encrypted backup.');
    const bytes = hex => new Uint8Array((hex.match(/.{2}/g) || []).map(pair => parseInt(pair, 16)));
    try {
      const key = await derive(passphrase, bytes(envelope.salt), cryptoApi);
      const clear = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv: bytes(envelope.iv) }, key, bytes(envelope.ciphertext));
      const data = JSON.parse(decoder.decode(clear));
      if (!await verifyChecksum(data, cryptoApi)) throw new Error('Backup checksum failed.');
      return data;
    } catch (error) {
      if (error.message === 'Backup checksum failed.') throw error;
      throw new Error('Wrong passphrase or damaged backup.');
    }
  }
  const api = { withChecksum, verifyChecksum, encryptBackup, decryptBackup, iterations };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketLedgerBackupCrypto = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
