export type ReaderOpenRequest =
  | { path: string; source: "direct" }
  | { path: string; source: "vault"; vaultRoot: string; vaultWritable: boolean };

export type ReaderSource = ReaderOpenRequest["source"];

export type ReaderAccess = {
  path: string;
  source: ReaderSource;
  canWriteVault: boolean;
  status: string;
  vaultRoot?: string;
  relativePath: string;
  documentKey: string;
};
