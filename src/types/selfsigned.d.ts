declare module "selfsigned" {
  interface Attribute {
    name: string;
    value: string;
  }

  interface AltName {
    type: number;
    value?: string;
    ip?: string;
  }

  interface Extension {
    name: string;
    altNames?: AltName[];
    cA?: boolean;
    pathLenConstraint?: number;
  }

  interface Options {
    keySize?: number;
    days?: number;
    algorithm?: string;
    extensions?: Extension[];
    pkcs7?: boolean;
    clientCertificate?: boolean;
    clientCertificateCN?: string;
  }

  interface GenerateResult {
    private: string;
    public: string;
    cert: string;
    fingerprint: string;
  }

  function generate(attrs?: Attribute[], options?: Options): GenerateResult;

  export default { generate };
}
