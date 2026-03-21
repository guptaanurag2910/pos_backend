export type AppRole = 'admin' | 'manager' | 'cashier';

export type SidebarTabKey =
  | 'dashboard'
  | 'billing'
  | 'returns'
  | 'inventory'
  | 'purchase'
  | 'customers'
  | 'reports'
  | 'initialUpload'
  | 'users'
  | 'settings';

// UI-only tab visibility. Edit this object to quickly change sidebar access per role.
export const SIDEBAR_TAB_VISIBILITY: Record<AppRole, Record<SidebarTabKey, boolean>> = {
  admin: {
    dashboard: true,
    billing: true,
    returns: true,
    inventory: true,
    purchase: true,
    customers: true,
    reports: true,
    initialUpload: true,
    users: true,
    settings: true,
  },
  manager: {
    dashboard: true,
    billing: true,
    returns: true,
    inventory: true,
    purchase: true,
    customers: true,
    reports: true,
    initialUpload: false,
    users: false,
    settings: false,
  },
  cashier: {
    dashboard: false,
    billing: true,
    returns: true,
    inventory: false,
    purchase: false,
    customers: false,
    reports: false,
    initialUpload: false,
    users: false,
    settings: false,
  },
};

export const canShowSidebarTab = (
  role: string | undefined,
  tab: SidebarTabKey
): boolean => {
  if (!role) return false;
  if (!(role in SIDEBAR_TAB_VISIBILITY)) return false;
  return SIDEBAR_TAB_VISIBILITY[role as AppRole][tab];
};

