import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { bootstrapStoreImport } from '../service/storeService';
import { useAuthStore } from '../stores/authStore';
import { usePOSStore } from '../stores/posStore';

const InitialDataUploadPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { loadProducts } = usePOSStore();
  const [file, setFile] = useState<File | null>(null);
  const [strictImport, setStrictImport] = useState(true);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const storeId = Number(user?.storeId || 0);
    if (!storeId) {
      setError('Logged-in user is not associated with a store.');
      return;
    }

    if (!file) {
      setError('Please select an Excel file to upload.');
      return;
    }

    setIsUploading(true);
    try {
      await bootstrapStoreImport(storeId, file, strictImport);
      await loadProducts();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to import initial data.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Initial Data Upload</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload your store bootstrap Excel after login to populate inventory, customers, sales, and related tables.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error-50 dark:bg-error-900/40 text-error-700 dark:text-error-300 flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <a
            href="/bootstrap/store_bootstrap_designed_template.xlsx"
            download
            className="inline-flex items-center px-3 py-2 text-sm border border-primary-300 text-primary-700 dark:text-primary-300 dark:border-primary-500 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30"
          >
            <FileSpreadsheet size={16} className="mr-2" />
            Download Designed Template
          </a>
          <a
            href="/bootstrap/store_bootstrap_sample.xlsx"
            download
            className="inline-flex items-center px-3 py-2 text-sm border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <FileSpreadsheet size={16} className="mr-2" />
            Download Sample File
          </a>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <UploadCloud size={16} />
          Select Excel File (.xlsx)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-700 dark:text-gray-200"
        />

        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={strictImport}
            onChange={(e) => setStrictImport(e.target.checked)}
          />
          Strict import mode (stop on invalid rows)
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isUploading}
            className={`px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 ${
              isUploading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isUploading ? 'Uploading...' : 'Upload & Populate Data'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Skip for Now
          </button>
        </div>
      </form>
    </div>
  );
};

export default InitialDataUploadPage;
