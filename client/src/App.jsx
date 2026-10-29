
import { useRef, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

function App() {
  const [page, setPage] = useState("verify");
  const [certificate, setCertificate] = useState(null);
  const [signature, setSignature] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const certificateRef = useRef(null);
  const signatureRef = useRef(null);
  const publicKeyRef = useRef(null);

  function resetResult() {
    setResult(null);
    setError("");
  }

  function changePage(nextPage) {
    setPage(nextPage);
    setCertificate(null);
    setSignature(null);
    setPublicKey(null);
    resetResult();
  }

  function selectFile(event, setter, allowedExtensions) {
    const file = event.target.files?.[0];
    if (!file) return;

    const valid = allowedExtensions.some((extension) =>
      file.name.toLowerCase().endsWith(extension)
    );

    if (!valid) {
      setError(`Please select a valid ${allowedExtensions.join(" or ")} file.`);
      event.target.value = "";
      setter(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10 MB.");
      event.target.value = "";
      setter(null);
      return;
    }

    setter(file);
    resetResult();
  }

  async function signCertificate() {
    if (!certificate) {
      setError("Please select a PDF certificate first.");
      return;
    }

    setLoading(true);
    resetResult();

    try {
      const formData = new FormData();
      formData.append("certificate", certificate);

      const response = await fetch(`${API}/sign`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Signing failed.");
      }

      const signatureBlob = await response.blob();
      downloadBlob(signatureBlob, "certificate.sig");

      setResult({
        valid: true,
        title: "Certificate signed successfully",
        message:
          "Your digital signature has been generated. Keep it with the original PDF.",
      });
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPublicKey() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/public-key`);

      if (!response.ok) {
        throw new Error("Could not download the issuer's public key.");
      }

      const blob = await response.blob();
      downloadBlob(blob, "issuer_public_key.pem");
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCertificate() {
    if (!certificate || !signature || !publicKey) {
      setError("Please select the PDF, signature, and public key.");
      return;
    }

    setLoading(true);
    resetResult();

    try {
      const formData = new FormData();
      formData.append("certificate", certificate);
      formData.append("signature", signature);
      formData.append("publicKey", publicKey);

      const response = await fetch(`${API}/verify`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok && typeof data.valid !== "boolean") {
        throw new Error(data.message || "Verification request failed.");
      }

      setResult({
        valid: data.valid === true,
        title: data.valid ? "Certificate is authentic" : "Verification failed",
        message: data.message,
      });
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function FileUpload({
    label,
    description,
    file,
    setter,
    extensions,
    inputRef,
    icon,
  }) {
    return (
      <div className="upload-field">
        <label className="field-label">{label}</label>

        <button
          type="button"
          className={`dropzone ${file ? "has-file" : ""}`}
          onClick={() => inputRef.current?.click()}
        >
          <span className="upload-icon">{icon}</span>
          <span className="upload-copy">
            <strong>{file ? file.name : "Click to browse files"}</strong>
            <small>{file ? "File selected" : description}</small>
          </span>
          <span className="browse-label">
            {file ? "Change" : "Browse"}
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={extensions.join(",")}
          hidden
          onChange={(event) => selectFile(event, setter, extensions)}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">S</div>
          <div>
            <strong>SealVerify</strong>
            <span>Certificate security</span>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <button
          className={`nav-item ${page === "verify" ? "active" : ""}`}
          onClick={() => changePage("verify")}
        >
          <span>⌕</span> Verify certificate
        </button>

        <button
          className={`nav-item ${page === "sign" ? "active" : ""}`}
          onClick={() => changePage("sign")}
        >
          <span>✎</span> Sign certificate
        </button>

        <div className="sidebar-bottom">
          <div className="security-card">
            <div className="security-icon">✓</div>
            <strong>Secure verification</strong>
            <p>RSA-2048 encryption with SHA-256 signatures.</p>
          </div>
          <span className="version-label">CNS PROJECT · v1.0</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            {page === "verify" ? "Verify certificate" : "Sign certificate"}
          </div>
          <div className="status-pill">
            <span className="status-dot" /> Local server
          </div>
        </header>

        <section className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">DIGITAL TRUST, MADE SIMPLE</div>
              <h1>
                {page === "verify"
                  ? "Certificate verification"
                  : "Sign a certificate"}
              </h1>
              <p>
                {page === "verify"
                  ? "Verify a PDF's digital signature and check whether its contents have been changed."
                  : "Upload a PDF certificate and generate a cryptographic digital signature."}
              </p>
            </div>
            <div className="heading-shield">✓</div>
          </div>

          <div className="steps-row">
            <div className="step">
              <span className="step-number">01</span>
              <div><strong>Upload files</strong><small>Select your documents</small></div>
            </div>
            <div className="step-line" />
            <div className="step">
              <span className="step-number">02</span>
              <div>
                <strong>{page === "verify" ? "Verify signature" : "Create signature"}</strong>
                <small>RSA + SHA-256</small>
              </div>
            </div>
            <div className="step-line" />
            <div className="step">
              <span className="step-number">03</span>
              <div><strong>Get result</strong><small>View status</small></div>
            </div>
          </div>

          <div className="workspace-grid">
            <section className="panel upload-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">STEP 01</span>
                  <h2>{page === "verify" ? "Upload verification files" : "Choose your certificate"}</h2>
                </div>
                <span className="panel-icon">↑</span>
              </div>

              <p className="panel-description">
                {page === "verify"
                  ? "Provide the original PDF, its detached signature, and the trusted issuer's public key."
                  : "The server signs the exact PDF bytes. The PDF itself will not be altered."}
              </p>

              <FileUpload
                label="PDF CERTIFICATE"
                description="PDF document · Max 10 MB"
                file={certificate}
                setter={setCertificate}
                extensions={[".pdf"]}
                inputRef={certificateRef}
                icon="▤"
              />

              {page === "verify" ? (
                <>
                  <FileUpload
                    label="DIGITAL SIGNATURE"
                    description="Signature file · .sig"
                    file={signature}
                    setter={setSignature}
                    extensions={[".sig"]}
                    inputRef={signatureRef}
                    icon="⌁"
                  />

                  <FileUpload
                    label="ISSUER'S PUBLIC KEY"
                    description="PEM public key file"
                    file={publicKey}
                    setter={setPublicKey}
                    extensions={[".pem"]}
                    inputRef={publicKeyRef}
                    icon="♧"
                  />

                  <button
                    className="text-button"
                    onClick={downloadPublicKey}
                    disabled={loading}
                  >
                    ↓ Download this server's public key
                  </button>
                </>
              ) : (
                <div className="sign-info">
                  <span>🔐</span>
                  <p>
                    Your private key stays on the backend. After signing,
                    save the downloaded <strong>certificate.sig</strong> file
                    and share it with the PDF.
                  </p>
                </div>
              )}

              {error && <div className="error-message">! {error}</div>}

              <button
                className="primary-button"
                onClick={page === "verify" ? verifyCertificate : signCertificate}
                disabled={loading}
              >
                {loading
                  ? "Processing..."
                  : page === "verify"
                    ? "Verify certificate  →"
                    : "Generate digital signature  →"}
              </button>

              <div className="privacy-note">
                <span>♧</span> Files are processed by your local backend.
              </div>
            </section>

            <section className="panel result-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">STEP 02 / 03</span>
                  <h2>Verification result</h2>
                </div>
                <span className="panel-icon">◎</span>
              </div>

              {!result ? (
                <div className="empty-result">
                  <div className="empty-illustration">
                    <div className="document-shape">
                      <span />
                      <span />
                      <span />
                      <div className="document-check">✓</div>
                    </div>
                  </div>
                  <h3>Awaiting verification</h3>
                  <p>
                    Your result will appear here after you{" "}
                    {page === "verify" ? "verify the uploaded files" : "sign your PDF"}.
                  </p>
                  <div className="result-legend">
                    <div><span className="legend-dot green" /> Valid signature</div>
                    <div><span className="legend-dot red" /> Invalid signature</div>
                  </div>
                </div>
              ) : (
                <div className={`result-content ${result.valid ? "result-valid" : "result-invalid"}`}>
                  <div className="result-symbol">{result.valid ? "✓" : "!"}</div>
                  <span className="result-status">
                    {result.valid ? "SUCCESS" : "CHECK FAILED"}
                  </span>
                  <h3>{result.title}</h3>
                  <p>{result.message}</p>
                  <div className="result-details">
                    <div><span>Algorithm</span><strong>RSA-SHA256</strong></div>
                    <div><span>Document</span><strong>{certificate?.name || "PDF certificate"}</strong></div>
                    <div><span>Result</span><strong>{result.valid ? "Valid" : "Invalid"}</strong></div>
                  </div>
                  <button className="secondary-button" onClick={() => { resetResult(); }}>
                    Run another test
                  </button>
                </div>
              )}

              <div className="how-it-works">
                <div className="how-icon">i</div>
                <div>
                  <strong>How does it work?</strong>
                  <p>
                    A digital signature detects changes to signed data.
                    A valid signature alone does not prove who issued a
                    certificate unless the public key is trusted.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <footer className="page-footer">
            <span>SealVerify · Cryptography & Network Security</span>
            <span>RSA · SHA-256 · Digital signatures</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default App;
