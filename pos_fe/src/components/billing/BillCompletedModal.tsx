import { useRef } from 'react';
import { X, Printer, Download, Share2, Wallet } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface BillCompletedModalProps {
  bill: any;
  onClose: () => void;
  onNewBill: () => void;
}

const BillCompletedModal = ({ bill, onClose, onNewBill }: BillCompletedModalProps) => {
  const billRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
  if (!billRef.current) return;

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [75, 300] });
  let y = 10;
  const lineGap = 4;

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(8);

  pdf.text(`${bill.store_name || 'Store'}`, 10, y); y += lineGap;
  pdf.text(`GSTIN: 29ABCDE1234F1Z5`, 10, y); y += lineGap;
  pdf.text(`-------------------------------`, 10, y); y += lineGap;

  pdf.text(`Bill No : ${bill.bill_number}`, 10, y); y += lineGap;
  pdf.text(`Date    : ${new Date(bill.created_at).toLocaleString()}`, 10, y); y += lineGap;
  pdf.text(`Cust    : ${bill.customer_name || 'Walk-in Customer'}`, 10, y); y += lineGap;
  pdf.text(`Store   : ${bill.store_name || 'N/A'}`, 10, y); y += lineGap;
  pdf.text(`-------------------------------`, 10, y); y += lineGap;

  pdf.setFont('courier', 'bold');
  pdf.text(`ITEM`, 10, y); y += lineGap;
  pdf.setFont('courier', 'normal');

  bill.items?.forEach((item: any) => {
    const nameLines = pdf.splitTextToSize(item.product_name, 60);
    nameLines.forEach((line: string) => {
      pdf.text(`${line}`, 10, y); y += lineGap;
    });

    const qty = parseFloat(item.quantity).toFixed(2).padStart(5, ' ');
    const mrp = parseFloat(item.price).toFixed(2).padStart(7, ' ');
    const rate = parseFloat(item.total).toFixed(2).padStart(7, ' ');

    pdf.text(`QTY: ${qty}  MRP: ₹${mrp}  RATE: ₹${rate}`, 10, y); y += lineGap;
    pdf.text(`-------------------------------`, 10, y); y += lineGap;
  });

  pdf.text(`Subtotal     : ₹${parseFloat(bill.subtotal).toFixed(2)}`, 10, y); y += lineGap;
  pdf.text(`Tax          : ₹${parseFloat(bill.tax_total).toFixed(2)}`, 10, y); y += lineGap;
  pdf.text(`Discount     : -₹${parseFloat(bill.discount).toFixed(2)}`, 10, y); y += lineGap;
  pdf.text(`Total        : ₹${parseFloat(bill.total).toFixed(2)}`, 10, y); y += lineGap;

  const formattedPaymentMethod = bill.payment_method
    ? bill.payment_method.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : 'N/A';

  pdf.text(`Paid Via     : ${formattedPaymentMethod}`, 10, y); y += lineGap;
  pdf.text(`Points Earned: ${bill.points_earned || 0}`, 10, y); y += lineGap;
  pdf.text(`Points Used  : ${bill.points_redeemed || 0}`, 10, y); y += lineGap;
  pdf.text(`-------------------------------`, 10, y); y += lineGap;
  pdf.text(`Thank You! Visit Again`, 15, y);

  pdf.save(`${bill.bill_number || 'bill'}.pdf`);
};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 animate-fade-in">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">Bill Completed</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6" ref={billRef}>
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 mb-3">
              <Wallet size={32} />
            </div>
          </div>
          <div className="text-center mb-2">
            <h1 className="text-lg font-bold text-gray-800">{bill.store_name || 'Store'}</h1>
            <p className="text-gray-500 text-sm">GSTIN: 29ABCDE1234F1Z5</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-6 text-sm">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Bill Number:</span>
              <span className="font-medium">{bill.bill_number}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Date:</span>
              <span className="font-medium">{new Date(bill.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Customer:</span>
              <span className="font-medium">{bill.customer_name || 'Walk-in Customer'}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Store:</span>
              <span className="font-medium">{bill.store_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Items:</span>
              <span className="font-medium">{bill.items?.length || 0}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Payment Method:</span>
              <span className="font-medium">
                {bill.payment_method
                  ? bill.payment_method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
              <span className="text-gray-700 font-semibold">Total Amount:</span>
              <span className="font-bold text-primary-700">₹{parseFloat(bill.total).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-xs mt-2">
              <span className="text-gray-500">Subtotal:</span>
              <span>₹{parseFloat(bill.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Tax:</span>
              <span>₹{parseFloat(bill.tax_total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Discount:</span>
              <span>-₹{parseFloat(bill.discount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Points Earned:</span>
              <span>{bill.points_earned || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Points Redeemed:</span>
              <span>{bill.points_redeemed || 0}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 mb-6">
          <button disabled className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-200 text-gray-400 cursor-not-allowed">
            <Printer size={20} className="mb-1" />
            <span className="text-xs">Print</span>
          </button>
          <button onClick={handleDownload} className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-300 hover:bg-gray-50">
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