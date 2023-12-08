import { env as VARIABLE } from "../../63b57e98ebfd83002c5df0c5/.build";

const crypto = require('crypto');

class EncryptedUniqueId {
    static builder() {
        return new EncryptedUniqueIdBuilder();
    }
}

class EncryptedUniqueIdBuilder {
    constructor() {
        this.secretKey = null;
        this.uniqueId = null;
    }

    withSecretKey(secretKey) {
        this.secretKey = secretKey;
        return this;
    }

    uniqueId(uniqueId) {
        this.uniqueId = uniqueId;
        return this;
    }

    build() {
        const randomToken = this.generateRandomToken();
        const encrypted = this.encrypt(this.secretKey, this.addPrefixAndSuffix(randomToken));
        return {
            randomToken,
            encrypted,
            redirectUrl: `http://servisler.vodafone.com.tr/vsap/sa/${VARIABLE.VODAFONE.OFFER_KEY}/SUBS?euid=${encrypted}`,
        };
    }

    addPrefixAndSuffix(str) {
        return `vs-${str}-ap`;
    }

    encrypt(secretKey, randomToken) {
        const initializationVector = Buffer.alloc(16, 0);
        const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(secretKey), initializationVector);
        let encrypted = cipher.update(randomToken, 'utf-8', 'binary');
        encrypted += cipher.final('binary');
        return this.base64UrlEncode(encrypted);
    }

    base64UrlEncode(input) {
        return Buffer.from(input, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    generateRandomToken() {
        return crypto.randomBytes(16).toString('hex');
    }
}

class PmpResult {
    constructor(returnCode, msisdn, offerKey, contentKey, token, uid) {
        this.returnCode = returnCode;
        this.msisdn = msisdn;
        this.offerKey = offerKey;
        this.contentKey = contentKey;
        this.token = token;
        this.uid = uid;
    }

    static parser() {
        return new PmpResultParser();
    }

    getReturnCode() {
        return this.returnCode;
    }

    getMsisdn() {
        return this.msisdn;
    }

    getOfferKey() {
        return this.offerKey;
    }

    getContentKey() {
        return this.contentKey;
    }

    getToken() {
        return this.token;
    }

    getUid() {
        return this.uid;
    }
}

class PmpResultParser {
    static TOKEN_PREFIX = 'pmp';

    constructor() {
        // Default constructor
    }

    withSecretKey(secretKey) {
        this.secretKey = secretKey;
        return this;
    }

    pmpResult(encryptedPmpResult) {
        this.encryptedPmpResult = encryptedPmpResult;
        return this;
    }

    parse() {
        this.decryptAndParse(this.secretKey, this.encryptedPmpResult);
        return new PmpResult(
            this.returnCode,
            this.msisdn,
            this.offerKey,
            this.contentKey,
            this.token,
            this.uid
        );
    }

    decryptAndParse(secretKey, encryptedResult) {
        const decrypted = this.decrypt(secretKey, encryptedResult);
        const parts = decrypted.split('|');
        const prefix = parts[0];

        if (prefix !== PmpResultParser.TOKEN_PREFIX || parts.length !== 7) {
            throw new Error('Decrypted pmpResult is not valid');
        }

        this.returnCode = parts[1];
        this.msisdn = parts[2];
        this.offerKey = parts[3];
        this.contentKey = parts[4];
        this.token = parts[5];
        this.uid = parts[6];
    }

    decrypt(secretKey, encryptedResult) {
        const initializationVector = Buffer.alloc(16, 0);
        const base64Decoded = this.base64UrlDecode(encryptedResult);
        const decipher = crypto.createDecipheriv('aes-128-cbc', secretKey, initializationVector);
        let decrypted = decipher.update(base64Decoded, 'binary', 'utf8');
        decrypted += decipher.final('utf8');
        return this.pkcs5Unpad(decrypted);
    }

    base64UrlDecode(input) {
        return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    }

    pkcs5Unpad(text) {
        const pad = text.charCodeAt(text.length - 1);
        if (pad > text.length) {
            return text;
        }

        if (
            Array.from(text.slice(text.length - pad)).every((char) => char.charCodeAt(0) === pad)
        ) {
            return text.slice(0, text.length - pad);
        }

        return text;
    }
}

export function getRedirectURL() {
    const secretKey = VARIABLE.VODAFONE.SECRET_KEY;
    const { randomToken, encrypted, redirectUrl } = EncryptedUniqueId.builder()
        .withSecretKey(secretKey)
        .build();

    console.log("RandomToken:\n\t", randomToken);
    console.log("Encrypted:\n\t", encrypted);
    console.log("Redirect URL:\n\t", redirectUrl);

    return redirectUrl;
}

export function decryptToken(token) {
    const secretKey = VARIABLE.VODAFONE.SECRET_KEY;

    const encryptedPmpResult = token;
    const pmpResult = PmpResult.parser().withSecretKey(secretKey).pmpResult(encryptedPmpResult).parse();

    console.log('ReturnCode:\n\t' + pmpResult.getReturnCode() + '\n');
    console.log('Msisdn:\n\t' + pmpResult.getMsisdn() + '\n');
    console.log('OfferKey:\n\t' + pmpResult.getOfferKey() + '\n');
    console.log('ContentKey:\n\t' + pmpResult.getContentKey() + '\n');
    console.log('Token:\n\t' + pmpResult.getToken() + '\n');
    console.log('Uid:\n\t' + pmpResult.getUid() + '\n');

    return {
        msisdn: pmpResult.getMsisdn(),
        return_code: pmpResult.getReturnCode(),
        offer_key: pmpResult.getOfferKey(),
        content_key: pmpResult.getContentKey(),
        token: pmpResult.getToken(),
        uid: pmpResult.getUid()
    }
}