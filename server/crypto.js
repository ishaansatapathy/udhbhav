/**
 * Offline cryptography: SHA-256, RSA, digital signatures
 */

const crypto = require("crypto");

// Generate RSA key pair (2048-bit)
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

/** SHA-256 hash */
function sha256(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

/** Generate trip token */
function generateTripToken(data) {
  const payload = { ...data, timestamp: Date.now(), nonce: crypto.randomBytes(8).toString("hex") };
  return sha256(payload);
}

/** Sign emergency payload */
function signEmergencyPayload(payload) {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(JSON.stringify(payload));
  return sign.sign(privateKey, "base64");
}

/** Verify signature */
function verifySignature(payload, signature) {
  try {
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(JSON.stringify(payload));
    return verify.verify(publicKey, signature, "base64");
  } catch {
    return false;
  }
}

function getPublicKeyPem() {
  return publicKey;
}

module.exports = {
  sha256,
  generateTripToken,
  signEmergencyPayload,
  verifySignature,
  getPublicKeyPem,
};