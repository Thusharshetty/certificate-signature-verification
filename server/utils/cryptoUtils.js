
const crypto = require("crypto");

// Generate a digital signature for the PDF data
function signCertificate(pdfBuffer, privateKey) {
  const signer = crypto.createSign("RSA-SHA256");

  signer.update(pdfBuffer);
  signer.end();

  return signer.sign(privateKey, "base64");
}

// Verify the PDF using the issuer's public key
function verifyCertificate(pdfBuffer, signature, publicKey) {
  try {
    const verifier = crypto.createVerify("RSA-SHA256");

    verifier.update(pdfBuffer);
    verifier.end();

    return verifier.verify(publicKey, signature, "base64");
  } catch (error) {
    return false;
  }
}

module.exports = {
  signCertificate,
  verifyCertificate,
};
