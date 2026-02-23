import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, BarChart, Download, Calendar, FileText, RefreshCw, TrendingUp } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance';
import { fetchCustomerReport, fetchInventoryReport, fetchSalesReport } from '../service/reportService';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

type ReportType = 'sales' | 'inventory' | 'customers';

const ReportsPage = () => {
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [allTime, setAllTime] = useState(true);
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const canGenerate = useMemo(() => allTime || Boolean(startDate && endDate), [allTime, startDate, endDate]);

  const currency = (value: number | string | undefined) =>
    `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const formatDateLabel = (value: string) => {
    if (!value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const applyDatePreset = (preset: '7d' | '30d' | 'mtd' | 'ytd') => {
    setAllTime(false);
    const end = new Date();
    const start = new Date(end);

    if (preset === '7d') {
      start.setDate(end.getDate() - 6);
    }
    if (preset === '30d') {
      start.setDate(end.getDate() - 29);
    }
    if (preset === 'mtd') {
      start.setDate(1);
    }
    if (preset === 'ytd') {
      start.setMonth(0, 1);
    }

    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
    setCurrentPage(1);
  };

  const salesOverTimeRows = reportType === 'sales' ? preview?.sales_over_time || [] : [];
  const paymentMethodRows = reportType === 'sales' ? preview?.payment_methods || [] : [];
  const topProductsRows = reportType === 'sales' ? preview?.top_products || [] : [];
  const inventoryRows = reportType === 'inventory' ? preview?.inventory || [] : [];
  const customerRows = reportType === 'customers' ? preview?.purchase_data || [] : [];

  const loadPreview = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError('');
    try {
      const params = allTime ? { all_time: true } : { start_date: startDate, end_date: endDate };
      if (reportType === 'sales') {
        setPreview(await fetchSalesReport(params));
      } else if (reportType === 'inventory') {
        setPreview(await fetchInventoryReport(params));
      } else {
        setPreview(await fetchCustomerReport(params));
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to load report preview';
      setError(detail);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canGenerate) return;
    loadPreview();
  }, [reportType, startDate, endDate, allTime]);

  useEffect(() => {
    setCurrentPage(1);
  }, [reportType, searchTerm]);

  const generateCsvReport = async () => {
    if (!canGenerate) {
      setError('Please select both start and end dates');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let url = '/api/reports/sales/';
      if (reportType === 'inventory') url = '/api/reports/inventory/';
      if (reportType === 'customers') url = '/api/reports/customers/';

      const res = await axiosInstance.get(url, {
        params: {
          ...(allTime ? { all_time: true } : { start_date: startDate, end_date: endDate }),
          export: true,
        },
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv' });
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      const rangeTag = allTime ? 'all_time' : `${startDate}_${endDate}`;
      a.download = `${reportType}_report_${rangeTag}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(fileUrl);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to generate CSV');
    } finally {
      setLoading(false);
    }
  };

  const generatePdfReport = () => {
    const exportAllReportsPdf = async () => {
      setLoading(true);
      setError('');
      try {
        const params = allTime ? { all_time: true } : { start_date: startDate, end_date: endDate };
        const [salesData, inventoryData, customerData] = await Promise.all([
          fetchSalesReport(params),
          fetchInventoryReport(params),
          fetchCustomerReport(params),
        ]);

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          setError('Allow popups to export PDF');
          return;
        }

        const salesRows = salesData?.sales_over_time || [];
        const salesPaymentRows = salesData?.payment_methods || [];
        const salesTopRows = salesData?.top_products || [];
        const inventoryReportRows = inventoryData?.inventory || [];
        const customerReportRows = customerData?.purchase_data || [];

        const salesSummary = salesData?.summary || {};
        const inventorySummary = inventoryData?.summary || {};
        const customerSummary = customerData?.summary || {};

        const salesTrendTable = salesRows
          .map(
            (r: any) =>
              `<tr><td>${r.date || ''}</td><td>${Number(r.count || 0)}</td><td>${currency(r.total)}</td><td>${currency(r.average)}</td></tr>`
          )
          .join('');
        const salesPaymentTable = salesPaymentRows
          .map((r: any) => `<tr><td>${r.method || ''}</td><td>${Number(r.count || 0)}</td><td>${currency(r.total)}</td></tr>`)
          .join('');
        const salesTopTable = salesTopRows
          .map(
            (r: any) =>
              `<tr><td>${r.product_name || ''}</td><td>${Number(r.quantity || 0)}</td><td>${currency(r.revenue)}</td></tr>`
          )
          .join('');

        const inventoryTable = inventoryReportRows
          .map(
            (r: any) =>
              `<tr><td>${r.product_name || ''}</td><td>${r.store_name || ''}</td><td>${Number(r.quantity || 0)}</td><td>${currency(
                r.value
              )}</td><td>${r.status || ''}</td></tr>`
          )
          .join('');

        const customerTable = customerReportRows
          .map(
            (r: any) =>
              `<tr><td>${r.customer_name || ''}</td><td>${Number(r.purchase_count || 0)}</td><td>${currency(
                r.purchase_total
              )}</td><td>${currency(r.average_purchase)}</td></tr>`
          )
          .join('');

        printWindow.document.write(`
          <html>
            <head>
              <title>POS Detailed Report</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 18px; color: #111; }
                h1, h2, h3 { margin: 0 0 8px 0; }
                .meta { margin-bottom: 12px; color: #444; }
                .section { margin-top: 22px; page-break-inside: avoid; }
                .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 8px 0 12px 0; }
                .card { border: 1px solid #ddd; border-radius: 6px; padding: 8px; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 10px; }
                th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 11px; }
                th { background: #f6f6f6; }
              </style>
            </head>
            <body>
              <h1>POS Detailed Analytics Report</h1>
              <div class="meta">Range: ${allTime ? 'All Time' : `${startDate} to ${endDate}`}</div>

              <div class="section">
                <h2>1. Sales Report</h2>
                <div class="summary">
                  <div class="card"><strong>Total Sales:</strong> ${currency(salesSummary.total_sales)}</div>
                  <div class="card"><strong>Bill Count:</strong> ${Number(salesSummary.bill_count || 0)}</div>
                  <div class="card"><strong>Average Bill:</strong> ${currency(salesSummary.average_bill_value)}</div>
                </div>
                <h3>Sales Trend Data Points</h3>
                <table>
                  <thead><tr><th>Date</th><th>Bills</th><th>Total</th><th>Average</th></tr></thead>
                  <tbody>${salesTrendTable || '<tr><td colspan="4">No data</td></tr>'}</tbody>
                </table>
                <h3>Payment Method Breakdown</h3>
                <table>
                  <thead><tr><th>Method</th><th>Count</th><th>Total</th></tr></thead>
                  <tbody>${salesPaymentTable || '<tr><td colspan="3">No data</td></tr>'}</tbody>
                </table>
                <h3>Top Products by Revenue</h3>
                <table>
                  <thead><tr><th>Product</th><th>Quantity</th><th>Revenue</th></tr></thead>
                  <tbody>${salesTopTable || '<tr><td colspan="3">No data</td></tr>'}</tbody>
                </table>
              </div>

              <div class="section">
                <h2>2. Inventory Report</h2>
                <div class="summary">
                  <div class="card"><strong>Total Items:</strong> ${Number(inventorySummary.total_items || 0)}</div>
                  <div class="card"><strong>Low Stock:</strong> ${Number(inventorySummary.low_stock_items || 0)}</div>
                  <div class="card"><strong>Inventory Value:</strong> ${currency(inventorySummary.total_value)}</div>
                </div>
                <h3>Inventory Data Points</h3>
                <table>
                  <thead><tr><th>Product</th><th>Store</th><th>Qty</th><th>Value</th><th>Status</th></tr></thead>
                  <tbody>${inventoryTable || '<tr><td colspan="5">No data</td></tr>'}</tbody>
                </table>
              </div>

              <div class="section">
                <h2>3. Customer Report</h2>
                <div class="summary">
                  <div class="card"><strong>Total Customers:</strong> ${Number(customerSummary.total_customers || 0)}</div>
                  <div class="card"><strong>Active Customers:</strong> ${Number(customerSummary.active_customers || 0)}</div>
                  <div class="card"><strong>New Customers:</strong> ${Number(customerSummary.new_customers || 0)}</div>
                </div>
                <h3>Customer Spend Data Points</h3>
                <table>
                  <thead><tr><th>Customer</th><th>Purchases</th><th>Total Spend</th><th>Average Spend</th></tr></thead>
                  <tbody>${customerTable || '<tr><td colspan="4">No data</td></tr>'}</tbody>
                </table>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Failed to generate detailed PDF');
      } finally {
        setLoading(false);
      }
    };

    exportAllReportsPdf();
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset?.label ? `${context.dataset.label}: ` : '';
            const yVal = typeof context.parsed?.y !== 'undefined' ? context.parsed.y : context.parsed;
            return `${label}${reportType === 'inventory' ? Number(yVal || 0) : currency(yVal || 0)}`;
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (val: any) => (reportType === 'inventory' ? Number(val || 0) : currency(val || 0)),
        },
      },
    },
  };

  const lineData = useMemo(() => {
    if (reportType === 'sales') {
      return {
        labels: salesOverTimeRows.map((r: any) => formatDateLabel(r.date)),
        datasets: [
          {
            label: 'Total Sales',
            data: salesOverTimeRows.map((r: any) => Number(r.total || 0)),
            borderColor: '#0284c7',
            backgroundColor: 'rgba(2,132,199,0.15)',
            fill: true,
            tension: 0.3,
          },
        ],
      };
    }

    if (reportType === 'inventory') {
      const top = inventoryRows.slice(0, 12);
      return {
        labels: top.map((r: any) => r.product_name),
        datasets: [
          {
            label: 'Stock Quantity',
            data: top.map((r: any) => Number(r.quantity || 0)),
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22,163,74,0.15)',
            fill: true,
            tension: 0.25,
          },
        ],
      };
    }

    const top = customerRows.slice(0, 12);
    return {
      labels: top.map((r: any) => r.customer_name),
      datasets: [
        {
          label: 'Customer Spend',
          data: top.map((r: any) => Number(r.purchase_total || 0)),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.15)',
          fill: true,
          tension: 0.25,
        },
      ],
    };
  }, [reportType, salesOverTimeRows, inventoryRows, customerRows]);

  const barData = useMemo(
    () => ({
      labels:
        reportType === 'sales'
          ? topProductsRows.map((r: any) => r.product_name)
          : reportType === 'inventory'
          ? inventoryRows.slice(0, 10).map((r: any) => r.product_name)
          : customerRows.slice(0, 10).map((r: any) => r.customer_name),
      datasets: [
        {
          label: reportType === 'sales' ? 'Revenue' : reportType === 'inventory' ? 'Stock Qty' : 'Customer Spend',
          data:
            reportType === 'sales'
              ? topProductsRows.map((r: any) => Number(r.revenue || 0))
              : reportType === 'inventory'
              ? inventoryRows.slice(0, 10).map((r: any) => Number(r.quantity || 0))
              : customerRows.slice(0, 10).map((r: any) => Number(r.purchase_total || 0)),
          backgroundColor: '#16a34a',
        },
      ],
    }),
    [reportType, topProductsRows, inventoryRows, customerRows]
  );

  const doughnutData = useMemo(
    () => ({
      labels:
        reportType === 'sales'
          ? paymentMethodRows.map((r: any) => r.method)
          : reportType === 'inventory'
          ? ['Healthy', 'Low Stock', 'Out of Stock']
          : ['Active Customers', 'New Customers'],
      datasets: [
        {
          data:
            reportType === 'sales'
              ? paymentMethodRows.map((r: any) => Number(r.total || 0))
              : reportType === 'inventory'
              ? [
                  Math.max(
                    0,
                    Number(preview?.summary?.total_items || 0) -
                      Number(preview?.summary?.low_stock_items || 0) -
                      Number(preview?.summary?.out_of_stock_items || 0)
                  ),
                  Number(preview?.summary?.low_stock_items || 0),
                  Number(preview?.summary?.out_of_stock_items || 0),
                ]
              : [Number(preview?.summary?.active_customers || 0), Number(preview?.summary?.new_customers || 0)],
          backgroundColor: ['#0284c7', '#f59e0b', '#dc2626', '#16a34a'],
        },
      ],
    }),
    [reportType, paymentMethodRows, preview]
  );

  const tableRows = useMemo(() => {
    if (reportType === 'sales') return salesOverTimeRows;
    if (reportType === 'inventory') return inventoryRows;
    return customerRows;
  }, [reportType, salesOverTimeRows, inventoryRows, customerRows]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return tableRows;

    return tableRows.filter((row: any) => {
      if (reportType === 'sales') {
        return String(row.date || '').toLowerCase().includes(term);
      }
      if (reportType === 'inventory') {
        return (
          String(row.product_name || '').toLowerCase().includes(term) || String(row.store_name || '').toLowerCase().includes(term)
        );
      }
      return String(row.customer_name || '').toLowerCase().includes(term);
    });
  }, [tableRows, searchTerm, reportType]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);

      if (!typing && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (!e.altKey || e.metaKey || e.ctrlKey) return;

      const key = e.key.toLowerCase();
      if (key === '1') {
        e.preventDefault();
        setReportType('sales');
        return;
      }
      if (key === '2') {
        e.preventDefault();
        setReportType('inventory');
        return;
      }
      if (key === '3') {
        e.preventDefault();
        setReportType('customers');
        return;
      }
      if (key === '7') {
        e.preventDefault();
        applyDatePreset('7d');
        return;
      }
      if (key === '0') {
        e.preventDefault();
        applyDatePreset('30d');
        return;
      }
      if (key === 'm') {
        e.preventDefault();
        applyDatePreset('mtd');
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        applyDatePreset('ytd');
        return;
      }
      if (key === 'a') {
        e.preventDefault();
        setAllTime((v) => !v);
        return;
      }
      if (key === 'r' && canGenerate && !loading) {
        e.preventDefault();
        loadPreview();
        return;
      }
      if (key === 'c' && canGenerate && !loading) {
        e.preventDefault();
        generateCsvReport();
        return;
      }
      if (key === 'p' && !loading && !!preview) {
        e.preventDefault();
        generatePdfReport();
        return;
      }
      if (key === 'arrowleft') {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
        return;
      }
      if (key === 'arrowright') {
        e.preventDefault();
        setCurrentPage((p) => Math.min(totalPages, p + 1));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canGenerate, loading, preview, totalPages, loadPreview, generateCsvReport, generatePdfReport]);

  const hasTrendData =
    (reportType === 'sales' && salesOverTimeRows.length > 0) ||
    (reportType === 'inventory' && inventoryRows.length > 0) ||
    (reportType === 'customers' && customerRows.length > 0);
  const hasBreakdownData =
    (reportType === 'sales' && paymentMethodRows.length > 0) ||
    (reportType === 'inventory' && Number(preview?.summary?.total_items || 0) > 0) ||
    (reportType === 'customers' && Number(preview?.summary?.total_customers || 0) > 0);
  const hasTopData =
    (reportType === 'sales' && topProductsRows.length > 0) ||
    (reportType === 'inventory' && inventoryRows.length > 0) ||
    (reportType === 'customers' && customerRows.length > 0);

  const SkeletonBlock = () => <div className="h-full w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-600" />;
  const headlineValue =
    reportType === 'sales'
      ? currency(preview?.summary?.total_sales)
      : reportType === 'inventory'
      ? currency(preview?.summary?.total_value)
      : `${Number(preview?.summary?.total_customers || 0).toLocaleString('en-IN')}`;
  const headlineLabel =
    reportType === 'sales'
      ? 'Total Sales'
      : reportType === 'inventory'
      ? 'Inventory Value'
      : 'Total Customers';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Reports & Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">Generate and analyze business data</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadPreview}
            disabled={!canGenerate || loading}
            className="flex items-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
          >
            <RefreshCw size={18} className="mr-2" />
            Refresh
          </button>
          <button
            onClick={generateCsvReport}
            disabled={!canGenerate || loading}
            className={`flex items-center px-4 py-2 rounded-lg ${
              !canGenerate || loading
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-primary-600 dark:bg-primary-500 text-white hover:bg-primary-700 dark:hover:bg-primary-600'
            }`}
          >
            <Download size={18} className="mr-2" />
            {loading ? 'Generating...' : 'Download CSV'}
          </button>
          <button
            onClick={generatePdfReport}
            disabled={loading || !preview}
            className="flex items-center px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <FileText size={18} className="mr-2" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-600 text-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm/6 opacity-90">Owner Snapshot</p>
            <p className="text-3xl font-bold">{headlineValue}</p>
            <p className="text-sm opacity-90">{headlineLabel} {allTime ? '(All time)' : `(${startDate} to ${endDate})`}</p>
          </div>
          <div className="flex items-center gap-2 text-sm bg-white/15 px-3 py-2 rounded-lg">
            <TrendingUp size={16} />
            Auto insights from live transactions
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Report Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="sales">Sales Report</option>
              <option value="inventory">Inventory Report</option>
              <option value="customers">Customer Report</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={allTime}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={allTime}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex items-end text-sm text-gray-600 dark:text-gray-300">
            APIs auto-refresh when you change filters.
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setAllTime(true)}
            className={`px-3 py-1 text-sm rounded border dark:border-gray-600 ${allTime ? 'bg-primary-600 text-white border-primary-600' : ''}`}
          >
            All time
          </button>
          <button onClick={() => applyDatePreset('7d')} className="px-3 py-1 text-sm rounded border dark:border-gray-600">Last 7 days</button>
          <button onClick={() => applyDatePreset('30d')} className="px-3 py-1 text-sm rounded border dark:border-gray-600">Last 30 days</button>
          <button onClick={() => applyDatePreset('mtd')} className="px-3 py-1 text-sm rounded border dark:border-gray-600">Month to date</button>
          <button onClick={() => applyDatePreset('ytd')} className="px-3 py-1 text-sm rounded border dark:border-gray-600">Year to date</button>
        </div>

        <div className="mt-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium text-gray-700 dark:text-gray-200 mr-2">Keyboard:</span>
          <span className="mr-3">Type <kbd className="px-1 rounded border">/</kbd> search</span>
          <span className="mr-3"><kbd className="px-1 rounded border">Alt+1/2/3</kbd> report type</span>
          <span className="mr-3"><kbd className="px-1 rounded border">Alt+7</kbd> 7d</span>
          <span className="mr-3"><kbd className="px-1 rounded border">Alt+0</kbd> 30d</span>
          <span className="mr-3"><kbd className="px-1 rounded border">Alt+M</kbd> MTD</span>
          <span className="mr-3"><kbd className="px-1 rounded border">Alt+Y</kbd> YTD</span>
          <span className="mr-3"><kbd className="px-1 rounded border">Alt+A</kbd> all time</span>
          <span className="mr-3"><kbd className="px-1 rounded border">Alt+R</kbd> refresh</span>
          <span className="mr-3"><kbd className="px-1 rounded border">Alt+C</kbd> CSV</span>
          <span className="mr-3"><kbd className="px-1 rounded border">Alt+P</kbd> PDF</span>
          <span><kbd className="px-1 rounded border">Alt+←/→</kbd> page</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <LineChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Trend Analysis</h2>
          </div>
          <div className="h-64 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            {loading ? (
              <SkeletonBlock />
            ) : hasTrendData ? (
              <Line data={lineData} options={chartOptions as any} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">No trend data available for this report.</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart className="w-6 h-6 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Breakdown</h2>
          </div>
          <div className="h-64 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            {loading ? (
              <SkeletonBlock />
            ) : hasBreakdownData ? (
              <Doughnut data={doughnutData} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">No breakdown data available.</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart className="w-6 h-6 text-emerald-600" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Top Performers</h2>
        </div>
        <div className="h-72 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          {loading ? (
            <SkeletonBlock />
          ) : hasTopData ? (
            <Bar data={barData} options={chartOptions as any} />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">No performer data available.</div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Report Summary</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-16 rounded animate-pulse bg-gray-200 dark:bg-gray-700" />
            <div className="h-16 rounded animate-pulse bg-gray-200 dark:bg-gray-700" />
            <div className="h-16 rounded animate-pulse bg-gray-200 dark:bg-gray-700" />
            <div className="h-16 rounded animate-pulse bg-gray-200 dark:bg-gray-700" />
          </div>
        ) : reportType === 'sales' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded border dark:border-gray-700">Total Sales: <strong>{currency(preview?.summary?.total_sales)}</strong></div>
            <div className="p-3 rounded border dark:border-gray-700">Bill Count: <strong>{Number(preview?.summary?.bill_count || 0)}</strong></div>
            <div className="p-3 rounded border dark:border-gray-700">Avg Bill: <strong>{currency(preview?.summary?.average_bill_value)}</strong></div>
          </div>
        ) : reportType === 'inventory' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 rounded border dark:border-gray-700">Total Items: <strong>{Number(preview?.summary?.total_items || 0)}</strong></div>
            <div className="p-3 rounded border dark:border-gray-700">Low Stock: <strong>{Number(preview?.summary?.low_stock_items || 0)}</strong></div>
            <div className="p-3 rounded border dark:border-gray-700">Out of Stock: <strong>{Number(preview?.summary?.out_of_stock_items || 0)}</strong></div>
            <div className="p-3 rounded border dark:border-gray-700">Inventory Value: <strong>{currency(preview?.summary?.total_value)}</strong></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 rounded border dark:border-gray-700">Total Customers: <strong>{Number(preview?.summary?.total_customers || 0)}</strong></div>
            <div className="p-3 rounded border dark:border-gray-700">Active Customers: <strong>{Number(preview?.summary?.active_customers || 0)}</strong></div>
            <div className="p-3 rounded border dark:border-gray-700">New Customers: <strong>{Number(preview?.summary?.new_customers || 0)}</strong></div>
            <div className="p-3 rounded border dark:border-gray-700">Total Loyalty Points: <strong>{Number(preview?.loyalty?.total_points || 0)}</strong></div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex flex-wrap justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Detailed Data</h2>
          <div className="flex gap-2">
            <input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={reportType === 'sales' ? 'Search by date' : reportType === 'inventory' ? 'Search product/store' : 'Search customer'}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            />
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <div className="overflow-auto max-h-96 border rounded-lg dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                {reportType === 'sales' && (
                  <>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Bills</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Average</th>
                  </>
                )}
                {reportType === 'inventory' && (
                  <>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">Store</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Value</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </>
                )}
                {reportType === 'customers' && (
                  <>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-right">Purchases</th>
                    <th className="px-3 py-2 text-right">Total Spend</th>
                    <th className="px-3 py-2 text-right">Average Spend</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {!loading && pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={reportType === 'inventory' ? 5 : 4} className="px-3 py-6 text-center text-gray-500">
                    No rows found for current filters.
                  </td>
                </tr>
              ) : null}

              {reportType === 'sales' &&
                pagedRows.map((row: any, idx: number) => (
                  <tr key={idx} className="border-t dark:border-gray-700">
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2 text-right">{Number(row.count || 0)}</td>
                    <td className="px-3 py-2 text-right">{currency(row.total)}</td>
                    <td className="px-3 py-2 text-right">{currency(row.average)}</td>
                  </tr>
                ))}
              {reportType === 'inventory' &&
                pagedRows.map((row: any) => (
                  <tr key={`${row.id}-${row.product_name}`} className="border-t dark:border-gray-700">
                    <td className="px-3 py-2">{row.product_name}</td>
                    <td className="px-3 py-2">{row.store_name}</td>
                    <td className="px-3 py-2 text-right">{Number(row.quantity || 0)}</td>
                    <td className="px-3 py-2 text-right">{currency(row.value)}</td>
                    <td className="px-3 py-2">{row.status}</td>
                  </tr>
                ))}
              {reportType === 'customers' &&
                pagedRows.map((row: any) => (
                  <tr key={row.customer_id} className="border-t dark:border-gray-700">
                    <td className="px-3 py-2">{row.customer_name}</td>
                    <td className="px-3 py-2 text-right">{Number(row.purchase_count || 0)}</td>
                    <td className="px-3 py-2 text-right">{currency(row.purchase_total)}</td>
                    <td className="px-3 py-2 text-right">{currency(row.average_purchase)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="text-gray-600 dark:text-gray-300">
            Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 rounded border dark:border-gray-600 disabled:opacity-50"
            >
              Prev
            </button>
            <span>
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 rounded border dark:border-gray-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Sales Report</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Detailed analysis of sales transactions, revenue, and payment methods.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Inventory Report</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Stock levels, movement analysis, and product performance metrics.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-accent-600 dark:text-accent-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Customer Report</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Customer behavior, loyalty metrics, and purchase patterns.</p>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
