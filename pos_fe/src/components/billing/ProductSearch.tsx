import { useState, useEffect, useRef } from 'react';
import { Search, Loader, Plus, Package } from 'lucide-react';
import { Product } from '../../types';
import { listProducts } from '../../service/inventoryService';

interface ProductSearchProps {
  onSelectProduct: (product: Product) => void;
}

const ProductSearch = ({ onSelectProduct }: ProductSearchProps) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef<NodeJS.Timeout | null>(null);

  // Manual input search
  useEffect(() => {
    const handleSearch = async () => {
      if (query.trim().length === 0) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await listProducts({ search: query });
        const products = response.results || [];
        setResults(products);
        setIsOpen(products.length > 0);
      } catch (error) {
        console.error('Error searching products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Barcode scanner logic
  useEffect(() => {
    const handleBarcodeInput = (e: KeyboardEvent) => {
      if (barcodeTimer.current) clearTimeout(barcodeTimer.current);

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 3) {
          const scannedBarcode = barcodeBuffer.current;
          barcodeBuffer.current = '';
          handleBarcodeSearch(scannedBarcode);
        }
      } else {
        barcodeBuffer.current += e.key;
        barcodeTimer.current = setTimeout(() => {
          barcodeBuffer.current = '';
        }, 300);
      }
    };

    window.addEventListener('keydown', handleBarcodeInput);
    return () => window.removeEventListener('keydown', handleBarcodeInput);
  }, []);

  const handleBarcodeSearch = async (barcode: string) => {
    setIsLoading(true);
    try {
      const response = await listProducts({ search: barcode });
      const matches = response.results || [];

      if (matches.length === 1) {
        onSelectProduct(matches[0]);
        setQuery('');
        setIsOpen(false);
      } else {
        setResults(matches);
        setQuery(barcode);
        setIsOpen(matches.length > 0);
      }
    } catch (err) {
      console.error('Barcode search failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProduct = (product: Product) => {
    onSelectProduct(product);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader size={18} className="text-gray-400 dark:text-gray-500 animate-spin" />
          ) : (
            <Search size={18} className="text-gray-400 dark:text-gray-500" />
          )}
        </div>

        <input
          type="text"
          placeholder="Search or scan barcode..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-60 overflow-y-auto animate-slide-in">
          <ul className="py-1">
            {results.map((product) => (
              <li
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-10 w-10 rounded object-cover mr-3"
                    />
                  ) : (
                    <div className="h-10 w-10 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center mr-3">
                      <Package size={18} className="text-gray-500 dark:text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{product.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Code: {product.barcode} • Stock: {product.stock} {product.unit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mr-2">
                    ₹{Number(product.price || 0).toFixed(2)}
                  </p>
                  <button
                    className="p-1 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full hover:bg-primary-200 dark:hover:bg-primary-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectProduct(product);
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                No products found.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProductSearch;
