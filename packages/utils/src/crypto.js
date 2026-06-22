import CryptoJS from 'crypto-js';
export class Crypto {
  /** Secret */
  secret;
  constructor(secret) {
    this.secret = secret;
  }
  encrypt(data) {
    const dataString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(dataString, this.secret);
    return encrypted.toString();
  }
  decrypt(encrypted) {
    const decrypted = CryptoJS.AES.decrypt(encrypted, this.secret);
    const dataString = decrypted.toString(CryptoJS.enc.Utf8);
    try {
      return JSON.parse(dataString);
    } catch {
      // avoid parse error
      return null;
    }
  }
}
