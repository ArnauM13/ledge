export interface NavItem {
  /** Route path, also used as a stable id. */
  path: string;
  label: string;
}

/** Main sections. Order = order in the sidebar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: 'overview', label: 'Overview' },
  { path: 'accounts', label: 'Accounts' },
  { path: 'investments', label: 'Investments' },
  { path: 'crypto', label: 'Crypto' },
  { path: 'real-estate', label: 'Real Estate' },
  { path: 'liabilities', label: 'Liabilities' },
  { path: 'transactions', label: 'Transactions' },
  { path: 'analytics', label: 'Analytics' },
  { path: 'settings', label: 'Settings' },
];
