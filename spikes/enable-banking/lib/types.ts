// Subconjunt dels esquemes de https://enablebanking.com/docs/api/reference
// Només els camps que fan servir els spikes; la resta queda al .raw.json.

export type PsuType = 'personal' | 'business';

export interface AuthMethod {
  name?: string;
  title?: string;
  psu_type?: PsuType;
  approach?: string;
  hidden_method?: boolean;
}

export interface Aspsp {
  name: string;
  country: string;
  psu_types?: PsuType[];
  auth_methods?: AuthMethod[];
  /** En segons. */
  maximum_consent_validity?: number;
  beta?: boolean;
  bic?: string;
  required_psu_headers?: string[];
  payments?: unknown[];
  sandbox?: unknown;
}

export interface StartAuthResponse {
  url: string;
  authorization_id: string;
  psu_id_hash?: string;
}

export interface AccountResource {
  uid?: string;
  account_id?: { iban?: string; other?: unknown };
  name?: string;
  cash_account_type?: string;
  product?: string;
  currency?: string;
  usage?: string;
  psu_status?: string;
  identification_hash?: string;
}

export interface SessionCreated {
  session_id: string;
  accounts: AccountResource[];
  aspsp: { name: string; country: string };
  psu_type?: PsuType;
  access?: { valid_until?: string };
}

export interface SessionInfo {
  status?: string;
  accounts?: string[];
  access?: { valid_until?: string };
  aspsp?: { name: string; country: string };
  psu_type?: PsuType;
  created?: string;
  authorized?: string;
}

export interface Balance {
  name?: string;
  balance_amount?: { currency?: string; amount?: string };
  balance_type?: string;
  reference_date?: string;
  last_change_date_time?: string;
}

export interface Transaction {
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  status?: string;
  credit_debit_indicator?: string;
}

export interface TransactionsPage {
  transactions?: Transaction[];
  continuation_key?: string | null;
}
