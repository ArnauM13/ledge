// Shapes from https://enablebanking.com/docs/api/reference (only fields we use).

export interface AuthMethod {
  name?: string;
  title?: string;
  psu_type?: string;
  approach?: string;
  hidden_method?: boolean;
}

export interface AspspData {
  name: string;
  country: string;
  logo?: string;
  psu_types: string[];
  auth_methods: AuthMethod[];
  /** "Maximum consent validity which bank supports in seconds" */
  maximum_consent_validity: number;
  beta: boolean;
  bic?: string;
  required_psu_headers?: string[];
  payments?: unknown[];
  group?: { name?: string };
}

export interface AccountResource {
  uid?: string;
  account_id?: { iban?: string; other?: unknown };
  all_account_ids?: Array<{ identification?: string; scheme_name?: string }>;
  name?: string;
  details?: string;
  usage?: string;
  cash_account_type: string;
  product?: string;
  currency: string;
  psu_status?: string;
  identification_hash?: string;
}

export interface StoredSession {
  member: string;
  session_id: string;
  aspsp: { name: string; country: string };
  psu_type?: string;
  access?: { valid_until?: string };
  created_at: string;
  accounts: AccountResource[];
}
