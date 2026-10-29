
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
  signCertificate,
  verifyCertificate,
} = require("./utils/cryptoUtils");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const keysDirectory = path.join(__dirname, "keys");
const privateKeyPath = path.join(keysDirectory, "private_key.pem");
const publicKeyPath = path.join(keysDirectory, "public_key.pem");

// Create keys directory if it doesn't exist
fs.mkdirSync(keysDirectory, { recursive: true });

// Generate an RSA key pair for the issuer on first startup
if (
  !fs.existsSync(privateKeyPath) ||
  !fs.existsSync(publicKeyPath)
) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync(
    "rsa",
    {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    }
  );

  fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
  fs.writeFileSync(publicKeyPath, publicKey);
}

const privateKey = fs.readFileSync(privateKeyPath, "utf8");
const publicKey = fs.readFileSync(publicKeyPath, "utf8");

// Check uploaded files are PDFs
function isPdf(file) {
  return (
    file &&
    file.originalname.toLowerCase().endsWith(".pdf") &&
    file.buffer.subarray(0, 5).toString() === "%PDF-"
  );
}

// Download the issuer's public key
app.get("/api/public-key", (req, res) => {
  res.type("text/plain");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="issuer_public_key.pem"'
  );
  res.send(publicKey);
});

// Sign a PDF and return its detached signature
app.post("/api/sign", upload.single("certificate"), (req, res) => {
  try {
    const file = req.file;

    if (!isPdf(file)) {
      return res.status(400).json({
        message: "Please upload a valid PDF certificate.",
      });
    }

    const signature = signCertificate(file.buffer, privateKey);

    res.type("text/plain");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="certificate.sig"'
    );

    return res.send(signature);
  } catch (error) {
    return res.status(500).json({
      message: "Could not sign the certificate.",
    });
  }
});

// Verify a PDF using its signature and issuer public key
app.post(
  "/api/verify",
  upload.fields([
    { name: "certificate", maxCount: 1 },
    { name: "signature", maxCount: 1 },
    { name: "publicKey", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const certificate = req.files?.certificate?.[0];
      const signatureFile = req.files?.signature?.[0];
      const publicKeyFile = req.files?.publicKey?.[0];

      if (!isPdf(certificate) || !signatureFile || !publicKeyFile) {
        return res.status(400).json({
          message:
            "Upload a valid PDF, its signature file, and the issuer's public key.",
        });
      }

      const signature = signatureFile.buffer.toString("utf8").trim();
      const issuerPublicKey = publicKeyFile.buffer.toString("utf8");

      // Reject malformed signature files and keys
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
        return res.status(400).json({
          message: "The signature file is invalid.",
        });
      }

      crypto.createPublicKey(issuerPublicKey);

      const isValid = verifyCertificate(
        certificate.buffer,
        signature,
        issuerPublicKey
      );

      return res.json({
        valid: isValid,
        message: isValid
          ? "Certificate signature is valid."
          : "Invalid signature. The PDF may have been modified, or the signature/public key does not match.",
      });
    } catch (error) {
      return res.status(400).json({
        valid: false,
        message: "Verification failed. Check the signature and public key files.",
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
