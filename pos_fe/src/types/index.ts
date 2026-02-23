// Existing types...

// Settings Types
export interface StoreSettings {
  general: {
    storeName: string;
    contactEmail: string;
    contactPhone: string;
    address: string;
    currencyFormat: string;
    dateFormat: string;
    theme: 'light' | 'dark';
    taxInclusivePrices: boolean;
    language: string;
    timezone: string;
  };
  store: {
    gstNumber: string;
    panNumber: string;
    businessType: string;
    openingTime: string;
    closingTime: string;
    workingDays: string[];
    branches: {
      id: string;
      name: string;
      address: string;
      phone: string;
      email: string;
    }[];
  };
  payment: {
    methods: {
      [key: string]: {
        enabled: boolean;
        label: string;
        types?: string[];
        providers?: string[];
      };
    };
    gateway: {
      provider: string;
      enabled: boolean;
      testMode: boolean;
    };
  };
  billing: {
    invoicePrefix: string;
    invoiceStartNumber: number;
    termsAndConditions: string;
    footerText: string;
    logo: boolean;
    showGst: boolean;
    showHsn: boolean;
    duplicateCopy: boolean;
    thermalPrinterEnabled: boolean;
  };
  hardware: {
    printers: {
      id: string;
      name: string;
      type: string;
      model: string;
      ip: string;
      port: number;
      enabled: boolean;
    }[];
    scanner: {
      enabled: boolean;
      type: string;
      model: string;
    };
    weighingScale: {
      enabled: boolean;
      model: string | null;
      port: string | null;
    };
    cashDrawer: {
      enabled: boolean;
      model: string;
      openOnPrint: boolean;
    };
  };
  security: {
    passwordPolicy: {
      minLength: number;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      expiryDays: number;
    };
    sessionTimeout: number;
    allowMultipleLogins: boolean;
    ipWhitelist: string[];
    twoFactorAuth: boolean;
    auditLogs: boolean;
  };
  database: {
    backupSchedule: string;
    backupTime: string;
    retentionDays: number;
    autoCleanup: boolean;
    syncInterval: number;
    offlineMode: boolean;
    maxOfflineDays: number;
  };
}

// Add to existing AuthState interface
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  users: User[];
  settings: StoreSettings;
}