import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface ShortcutItem {
  keyLabel: string;
  action: string;
}

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { keyLabel: 'F2', action: 'Focus Search' },
];

const BILLING_SHORTCUTS: ShortcutItem[] = [
  { keyLabel: 'F2', action: 'Product Search' },
  { keyLabel: 'F7', action: 'Discount' },
  { keyLabel: 'F8', action: 'Hold Bill' },
  { keyLabel: 'F9', action: 'Payment' },
  { keyLabel: 'Arrows', action: 'Item Row/Field Navigation' },
  { keyLabel: 'Enter', action: 'Next Row (Qty/Disc)' },
  { keyLabel: 'Type Num', action: 'Edit Qty / Disc %' },
  { keyLabel: 'Cmd/Ctrl+N', action: 'New Bill' },
  { keyLabel: 'Esc', action: 'Close Popup' },
  { keyLabel: 'Mac', action: 'Use Fn + F-keys if needed' },
];

const RETURNS_SHORTCUTS: ShortcutItem[] = [
  { keyLabel: 'F2', action: 'Search Returns/Bills' },
  { keyLabel: 'F4', action: 'Process Return' },
  { keyLabel: 'Arrows', action: 'Navigate Returns / Qty Rows' },
  { keyLabel: 'Enter', action: 'Open Selected Return' },
  { keyLabel: 'Cmd/Ctrl+Enter', action: 'Submit Return' },
  { keyLabel: 'Cmd/Ctrl+R', action: 'Refresh List' },
  { keyLabel: 'Esc', action: 'Close Popup' },
  { keyLabel: 'Mac', action: 'Use Fn + F-keys if needed' },
];

const INVENTORY_SHORTCUTS: ShortcutItem[] = [
  { keyLabel: 'F2', action: 'Search Item' },
  { keyLabel: 'F3', action: 'Category Filter' },
  { keyLabel: 'F4', action: 'Add Product' },
  { keyLabel: 'Ctrl+R', action: 'Refresh List' },
  { keyLabel: 'Esc', action: 'Close Popup' },
];

const ShortcutRibbon = () => {
  const location = useLocation();

  const shortcuts = useMemo(() => {
    if (location.pathname.startsWith('/billing')) return BILLING_SHORTCUTS;
    if (location.pathname.startsWith('/returns')) return RETURNS_SHORTCUTS;
    if (location.pathname.startsWith('/inventory')) return INVENTORY_SHORTCUTS;
    return DEFAULT_SHORTCUTS;
  }, [location.pathname]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2">
      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          Keyboard Shortcuts:
        </span>
        {shortcuts.map((shortcut) => (
          <span
            key={`${shortcut.keyLabel}-${shortcut.action}`}
            className="inline-flex items-center rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-100"
          >
            <kbd className="mr-1 rounded bg-white dark:bg-gray-900 px-1 py-0.5 text-[10px] font-semibold text-gray-800 dark:text-gray-100">
              {shortcut.keyLabel}
            </kbd>
            {shortcut.action}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ShortcutRibbon;
