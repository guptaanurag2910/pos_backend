import { useEffect, useMemo, useState } from 'react';
import { X, Printer, Download, Share2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuthStore } from '../../stores/authStore';
import { getStore } from '../../service/storeService';

interface BillCompletedModalProps {
  bill: any;
  onClose: () => void;
  onNewBill: () => void;
}

type ReceiptTemplate = 'thermal' | 'a4';

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (value: unknown) => `\u20b9${toNumber(value).toFixed(2)}`;

const formatDateTime = (value: unknown) => {
  const dt = value ? new Date(String(value)) : new Date();
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPaymentMethod = (value: unknown) =>
  String(value || 'N/A')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toDataUrl = async (url: string) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const BillCompletedModal = ({ bill, onClose, onNewBill }: BillCompletedModalProps) => {
  const { user } = useAuthStore();
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [template, setTemplate] = useState<ReceiptTemplate>('thermal');

  const items = useMemo(() => {
    const rows = Array.isArray(bill?.items) ? bill.items : [];
    return rows.map((item: any) => ({
      tax: toNumber(item.tax_rate ?? item.tax),
      name: String(item.product_name || item.productName || item.name || 'Item'),
      qty: toNumber(item.quantity),
      rate: toNumber(
        item.rate ??
          (toNumber(item.price ?? item.unit_price) * (1 + toNumber(item.tax_rate ?? item.tax) / 100))
      ),
      amount: toNumber(item.total ?? item.amount),
    }));
  }, [bill]);

  useEffect(() => {
    const loadStoreProfile = async () => {
      const storeId = Number(bill?.store || user?.storeId || 0);
      if (!storeId) return;

      try {
        const store = await getStore(storeId);
        setStoreProfile(store);

        const logoUrl = (store as any)?.settings?.store_logo || (store as any)?.store_logo || null;

        if (logoUrl) {
          try {
            const resolved = String(logoUrl).startsWith('http')
              ? String(logoUrl)
              : `${window.location.origin}${logoUrl}`;
            const dataUrl = await toDataUrl(resolved);
            setLogoDataUrl(dataUrl);
          } catch (error) {
            console.warn('Failed to load store logo for bill receipt:', error);
            setLogoDataUrl(null);
          }
        } else {
          setLogoDataUrl(null);
        }
      } catch (error) {
        console.warn('Failed to load store details for bill receipt:', error);
      }
    };

    loadStoreProfile();
  }, [bill?.store, user?.storeId]);

  const buildThermalPdf = async () => {
    const paperWidth = 76;
    const margin = 4;
    const contentWidth = paperWidth - margin * 2;
    const leftColWidth = 34;
    const lineHeight = 3.8;

    const estimatedItemLines = items.reduce((sum, item) => {
      const roughNameLines = Math.max(1, Math.ceil(item.name.length / 26));
      return sum + roughNameLines;
    }, 0);
    const estimatedHeight = Math.max(180, 95 + estimatedItemLines * lineHeight + items.length * lineHeight + 40);

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [paperWidth, Math.min(500, estimatedHeight)],
    });

    let y = 6;

    const ensureSpace = (needed = lineHeight) => {
      const pageHeight = pdf.internal.pageSize.getHeight();
      if (y + needed > pageHeight - 8) {
        pdf.addPage([paperWidth, pageHeight]);
        y = 8;
      }
    };

    if (logoDataUrl) {
      try {
        const logoWidth = 16;
        const logoHeight = 16;
        pdf.addImage(logoDataUrl, 'PNG', (paperWidth - logoWidth) / 2, y, logoWidth, logoHeight);
        y += logoHeight + 1;
      } catch (error) {
        console.warn('Unable to render logo in thermal PDF:', error);
      }
    }

    pdf.setTextColor(20, 20, 20);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(String(storeProfile?.name || bill?.store_name || 'Your Store'), paperWidth / 2, y, { align: 'center' });
    y += lineHeight;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);

    const addressLine = [storeProfile?.address, storeProfile?.city, storeProfile?.state]
      .filter(Boolean)
      .join(', ');

    if (addressLine) {
      const addressLines = pdf.splitTextToSize(addressLine, contentWidth);
      addressLines.forEach((line: string) => {
        pdf.text(line, paperWidth / 2, y, { align: 'center' });
        y += lineHeight;
      });
    }

    if (storeProfile?.gst_number) {
      pdf.text(`GSTIN: ${storeProfile.gst_number}`, paperWidth / 2, y, { align: 'center' });
      y += lineHeight;
    }

    if (storeProfile?.phone) {
      pdf.text(`Phone: ${storeProfile.phone}`, paperWidth / 2, y, { align: 'center' });
      y += lineHeight;
    }

    pdf.setDrawColor(90, 90, 90);
    pdf.line(margin, y, paperWidth - margin, y);
    y += lineHeight;

    pdf.setFontSize(8);
    pdf.text(`Bill: ${bill?.bill_number || 'N/A'}`, margin, y);
    pdf.text(`Date: ${formatDateTime(bill?.created_at)}`, paperWidth - margin, y, { align: 'right' });
    y += lineHeight;

    pdf.text(`Customer: ${bill?.customer_name || 'Walk-in Customer'}`, margin, y);
    y += lineHeight;

    if (bill?.cashier_name) {
      pdf.text(`Cashier: ${bill.cashier_name}`, margin, y);
      y += lineHeight;
    }

    pdf.line(margin, y, paperWidth - margin, y);
    y += lineHeight;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Item', margin, y);
    pdf.text('Qty', margin + 42, y, { align: 'right' });
    pdf.text('Rate', margin + 55, y, { align: 'right' });
    pdf.text('Amt', paperWidth - margin, y, { align: 'right' });
    y += lineHeight;
    pdf.setFont('helvetica', 'normal');

    items.forEach((item) => {
      ensureSpace(lineHeight * 2.5);
      const nameLines = pdf.splitTextToSize(item.name, leftColWidth);

      nameLines.forEach((line: string, index: number) => {
        pdf.text(line, margin, y);
        if (index === 0) {
          pdf.text(item.qty.toFixed(2), margin + 42, y, { align: 'right' });
          pdf.text(item.rate.toFixed(2), margin + 55, y, { align: 'right' });
          pdf.text(item.amount.toFixed(2), paperWidth - margin, y, { align: 'right' });
        }
        y += lineHeight;
      });
    });

    pdf.line(margin, y, paperWidth - margin, y);
    y += lineHeight;

    const drawTotalLine = (label: string, value: string, bold = false) => {
      ensureSpace(lineHeight + 0.5);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.text(label, margin, y);
      pdf.text(value, paperWidth - margin, y, { align: 'right' });
      y += lineHeight;
    };

    drawTotalLine('Subtotal', formatCurrency(bill?.subtotal));
    drawTotalLine('Tax', formatCurrency(bill?.tax_total));
    drawTotalLine('Discount', `-${formatCurrency(bill?.discount)}`);
    drawTotalLine('Round Off', formatCurrency(bill?.round_off || 0));
    drawTotalLine('Grand Total', formatCurrency(bill?.total), true);

    y += 1;
    pdf.line(margin, y, paperWidth - margin, y);
    y += lineHeight;

    drawTotalLine('Paid Via', formatPaymentMethod(bill?.payment_method));
    drawTotalLine('Points Earned', String(bill?.points_earned || 0));
    drawTotalLine('Points Used', String(bill?.points_redeemed || 0));

    y += 1;
    pdf.line(margin, y, paperWidth - margin, y);
    y += lineHeight;

    pdf.setFont('helvetica', 'bold');
    pdf.text('THANK YOU FOR SHOPPING!', paperWidth / 2, y, { align: 'center' });
    y += lineHeight;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(`Ref: ${bill?.bill_number || 'N/A'}`, paperWidth / 2, y, { align: 'center' });

    return pdf;
  };

  const buildA4Pdf = async () => {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;

    let y = margin;

    const ensureSpace = (needed: number, includeTableHeader = false) => {
      if (y + needed <= pageHeight - margin) return;
      pdf.addPage();
      y = margin;
      if (includeTableHeader) {
        drawItemsHeader();
      }
    };

    const drawItemsHeader = () => {
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, y, pageWidth - margin * 2, 8, 'F');
      pdf.setDrawColor(210, 210, 210);
      pdf.rect(margin, y, pageWidth - margin * 2, 8);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('Item Description', margin + 2, y + 5.4);
      pdf.text('Qty', margin + 112, y + 5.4, { align: 'right' });
      pdf.text('Rate', margin + 132, y + 5.4, { align: 'right' });
      pdf.text('Tax%', margin + 150, y + 5.4, { align: 'right' });
      pdf.text('Amount', pageWidth - margin - 2, y + 5.4, { align: 'right' });
      y += 8;
    };

    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, 'PNG', margin, y, 18, 18);
      } catch (error) {
        console.warn('Unable to render logo in A4 PDF:', error);
      }
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(String(storeProfile?.name || bill?.store_name || 'Your Store'), margin + 24, y + 6);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const headerAddress = [storeProfile?.address, storeProfile?.city, storeProfile?.state, storeProfile?.pincode]
      .filter(Boolean)
      .join(', ');
    if (headerAddress) {
      pdf.text(headerAddress, margin + 24, y + 11);
    }

    const gstText = storeProfile?.gst_number ? `GSTIN: ${storeProfile.gst_number}` : '';
    const phoneText = storeProfile?.phone ? `Phone: ${storeProfile.phone}` : '';
    const contactLine = [gstText, phoneText].filter(Boolean).join('   |   ');
    if (contactLine) {
      pdf.text(contactLine, margin + 24, y + 16);
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('TAX INVOICE', pageWidth - margin, y + 7, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Invoice No: ${bill?.bill_number || 'N/A'}`, pageWidth - margin, y + 12, { align: 'right' });
    pdf.text(`Date: ${formatDateTime(bill?.created_at)}`, pageWidth - margin, y + 17, { align: 'right' });

    y += 24;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('Bill To', margin, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Customer: ${bill?.customer_name || 'Walk-in Customer'}`, margin, y);
    y += 5;

    if (bill?.cashier_name) {
      pdf.text(`Cashier: ${bill.cashier_name}`, margin, y);
      y += 5;
    }

    y += 3;
    drawItemsHeader();

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    items.forEach((item) => {
      const nameLines = pdf.splitTextToSize(item.name, 88);
      const rowHeight = Math.max(7, nameLines.length * 4.5 + 1.5);
      ensureSpace(rowHeight + 1, true);

      pdf.setDrawColor(235, 235, 235);
      pdf.rect(margin, y, pageWidth - margin * 2, rowHeight);

      nameLines.forEach((line: string, idx: number) => {
        pdf.text(line, margin + 2, y + 5 + idx * 4.2);
      });

      const centerY = y + rowHeight / 2 + 1.5;
      pdf.text(item.qty.toFixed(2), margin + 112, centerY, { align: 'right' });
      pdf.text(item.rate.toFixed(2), margin + 132, centerY, { align: 'right' });
      pdf.text(item.tax.toFixed(2), margin + 150, centerY, { align: 'right' });
      pdf.text(item.amount.toFixed(2), pageWidth - margin - 2, centerY, { align: 'right' });

      y += rowHeight;
    });

    y += 4;
    ensureSpace(52);

    const summaryX = pageWidth - margin - 72;
    pdf.setDrawColor(210, 210, 210);
    pdf.rect(summaryX, y, 72, 38);

    const writeSummaryLine = (label: string, value: string, offsetY: number, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.text(label, summaryX + 3, y + offsetY);
      pdf.text(value, summaryX + 69, y + offsetY, { align: 'right' });
    };

    writeSummaryLine('Subtotal', formatCurrency(bill?.subtotal), 7);
    writeSummaryLine('Tax', formatCurrency(bill?.tax_total), 13);
    writeSummaryLine('Discount', `-${formatCurrency(bill?.discount)}`, 19);
    writeSummaryLine('Round Off', formatCurrency(bill?.round_off || 0), 25);
    writeSummaryLine('Grand Total', formatCurrency(bill?.total), 33, true);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Payment Mode: ${formatPaymentMethod(bill?.payment_method)}`, margin, y + 9);
    pdf.text(`Points Earned: ${bill?.points_earned || 0}`, margin, y + 15);
    pdf.text(`Points Used: ${bill?.points_redeemed || 0}`, margin, y + 21);

    y += 48;
    ensureSpace(22);

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 7;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('Thank you for shopping with us!', pageWidth / 2, y, { align: 'center' });
    y += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('This is a computer-generated invoice and does not require signature.', pageWidth / 2, y, {
      align: 'center',
    });

    return pdf;
  };

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      const pdf = template === 'a4' ? await buildA4Pdf() : await buildThermalPdf();
      const fileSuffix = template === 'a4' ? 'a4-tax-invoice' : 'thermal-receipt';
      pdf.save(`${bill?.bill_number || 'bill'}_${fileSuffix}.pdf`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsGenerating(true);
      const pdf = template === 'a4' ? await buildA4Pdf() : await buildThermalPdf();
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            iframe.remove();
          }, 1500);
        }
      };

      document.body.appendChild(iframe);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 animate-fade-in max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">Bill Completed</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setTemplate('thermal')}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                template === 'thermal'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Thermal 3-inch
            </button>
            <button
              type="button"
              onClick={() => setTemplate('a4')}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                template === 'a4'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              A4 Tax Invoice
            </button>
          </div>

          {template === 'thermal' ? (
            <div className="flex justify-center">
              <div className="w-full max-w-[360px] rounded-md border border-gray-200 bg-white p-4 shadow-sm font-mono text-[12px] leading-5 text-gray-900">
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="Store Logo" className="mx-auto h-14 w-14 object-contain mb-2" />
                ) : (
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                    {String(storeProfile?.name || bill?.store_name || 'S').slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
                  <p className="text-sm font-bold tracking-wide uppercase">
                    {storeProfile?.name || bill?.store_name || 'Your Store'}
                  </p>
                  {storeProfile?.address && <p>{storeProfile.address}</p>}
                  {(storeProfile?.city || storeProfile?.state) && (
                    <p>{[storeProfile?.city, storeProfile?.state, storeProfile?.pincode].filter(Boolean).join(', ')}</p>
                  )}
                  {storeProfile?.gst_number && <p>GSTIN: {storeProfile.gst_number}</p>}
                  {storeProfile?.phone && <p>Phone: {storeProfile.phone}</p>}
                </div>

                <div className="mb-2 border-b border-dashed border-gray-400 pb-2">
                  <div className="flex justify-between"><span>Bill No</span><span className="font-semibold">{bill?.bill_number}</span></div>
                  <div className="flex justify-between"><span>Date</span><span>{formatDateTime(bill?.created_at)}</span></div>
                  <div className="flex justify-between"><span>Customer</span><span className="ml-2 truncate">{bill?.customer_name || 'Walk-in Customer'}</span></div>
                  {bill?.cashier_name && (
                    <div className="flex justify-between"><span>Cashier</span><span>{bill.cashier_name}</span></div>
                  )}
                </div>

                <div className="mb-2 border-b border-dashed border-gray-400 pb-2">
                  <div className="grid grid-cols-12 font-bold">
                    <span className="col-span-5">Item</span>
                    <span className="col-span-2 text-right">Qty</span>
                    <span className="col-span-2 text-right">Rate</span>
                    <span className="col-span-3 text-right">Amt</span>
                  </div>

                  <div className="mt-1 space-y-1">
                    {items.map((item, index) => (
                      <div key={`${item.name}-${index}`}>
                        <div className="grid grid-cols-12">
                          <span className="col-span-5 break-words leading-4">{item.name}</span>
                          <span className="col-span-2 text-right">{item.qty.toFixed(2)}</span>
                          <span className="col-span-2 text-right">{item.rate.toFixed(2)}</span>
                          <span className="col-span-3 text-right">{item.amount.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-0.5 border-b border-dashed border-gray-400 pb-2 mb-2">
                  <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(bill?.subtotal)}</span></div>
                  <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(bill?.tax_total)}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(bill?.discount)}</span></div>
                  <div className="flex justify-between"><span>Round Off</span><span>{formatCurrency(bill?.round_off || 0)}</span></div>
                  <div className="flex justify-between text-sm font-bold"><span>Grand Total</span><span>{formatCurrency(bill?.total)}</span></div>
                </div>

                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between"><span>Paid Via</span><span>{formatPaymentMethod(bill?.payment_method)}</span></div>
                  <div className="flex justify-between"><span>Points Earned</span><span>{bill?.points_earned || 0}</span></div>
                  <div className="flex justify-between"><span>Points Used</span><span>{bill?.points_redeemed || 0}</span></div>
                </div>

                <div className="mt-3 border-t border-dashed border-gray-400 pt-2 text-center text-[11px]">
                  <p className="font-bold tracking-wide">THANK YOU FOR SHOPPING!</p>
                  <p className="tracking-wider">Ref: {bill?.bill_number || 'N/A'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-full max-w-[820px] rounded-md border border-gray-200 bg-white p-6 shadow-sm text-gray-900">
                <div className="flex items-start justify-between border-b border-gray-200 pb-4">
                  <div className="flex items-start gap-3">
                    {logoDataUrl ? (
                      <img src={logoDataUrl} alt="Store Logo" className="h-14 w-14 object-contain" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-sm font-bold text-gray-700">
                        {String(storeProfile?.name || bill?.store_name || 'S').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-bold">{storeProfile?.name || bill?.store_name || 'Your Store'}</h3>
                      {storeProfile?.address && <p className="text-sm text-gray-600">{storeProfile.address}</p>}
                      {(storeProfile?.city || storeProfile?.state) && (
                        <p className="text-sm text-gray-600">
                          {[storeProfile?.city, storeProfile?.state, storeProfile?.pincode].filter(Boolean).join(', ')}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        {[storeProfile?.gst_number ? `GSTIN: ${storeProfile.gst_number}` : null, storeProfile?.phone ? `Phone: ${storeProfile.phone}` : null]
                          .filter(Boolean)
                          .join(' | ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">TAX INVOICE</p>
                    <p className="text-sm">Invoice No: {bill?.bill_number || 'N/A'}</p>
                    <p className="text-sm">Date: {formatDateTime(bill?.created_at)}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold">Bill To</p>
                    <p>Customer: {bill?.customer_name || 'Walk-in Customer'}</p>
                    {bill?.cashier_name && <p>Cashier: {bill.cashier_name}</p>}
                  </div>
                  <div className="text-right">
                    <p>Payment: {formatPaymentMethod(bill?.payment_method)}</p>
                    <p>Points Earned: {bill?.points_earned || 0}</p>
                    <p>Points Used: {bill?.points_redeemed || 0}</p>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded border border-gray-200">
                  <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
                    <span className="col-span-5">Item Description</span>
                    <span className="col-span-2 text-right">Qty</span>
                    <span className="col-span-2 text-right">Rate</span>
                    <span className="col-span-1 text-right">Tax%</span>
                    <span className="col-span-2 text-right">Amount</span>
                  </div>
                  <div className="divide-y divide-gray-100 text-sm">
                    {items.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="grid grid-cols-12 px-3 py-2">
                        <span className="col-span-5">{item.name}</span>
                        <span className="col-span-2 text-right">{item.qty.toFixed(2)}</span>
                        <span className="col-span-2 text-right">{item.rate.toFixed(2)}</span>
                        <span className="col-span-1 text-right">{item.tax.toFixed(2)}</span>
                        <span className="col-span-2 text-right font-medium">{item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="w-full max-w-xs rounded border border-gray-200 p-3 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(bill?.subtotal)}</span></div>
                    <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(bill?.tax_total)}</span></div>
                    <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(bill?.discount)}</span></div>
                    <div className="flex justify-between"><span>Round Off</span><span>{formatCurrency(bill?.round_off || 0)}</span></div>
                    <div className="mt-2 border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
                      <span>Grand Total</span>
                      <span>{formatCurrency(bill?.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-gray-200 pt-3 text-center text-xs text-gray-600">
                  <p className="font-semibold text-gray-700">Thank you for shopping with us!</p>
                  <p>This is a computer-generated invoice and does not require signature.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 mb-6">
          <button
            onClick={handlePrint}
            disabled={isGenerating}
            className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
          >
            <Printer size={20} className="mb-1 text-gray-600" />
            <span className="text-xs">Print</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
          >
            <Download size={20} className="mb-1 text-gray-600" />
            <span className="text-xs">Download</span>
          </button>
          <button disabled className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-200 text-gray-400 cursor-not-allowed">
            <Share2 size={20} className="mb-1" />
            <span className="text-xs">Share</span>
          </button>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onNewBill}
            className="w-full py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
          >
            Start New Bill
          </button>
        </div>
      </div>
    </div>
  );
};

export default BillCompletedModal;
