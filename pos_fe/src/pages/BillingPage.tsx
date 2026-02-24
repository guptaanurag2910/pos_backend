import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CreditCard,
  PauseCircle,
  RotateCcw,
  Percent,
  PlusCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePOSStore } from '../stores/posStore';
import { Product, Customer, Bill } from '../types';
import ProductSearch from '../components/billing/ProductSearch';
import BillItemsList from '../components/billing/BillItemsList';
import BillSummary from '../components/billing/BillSummary';
import CustomerSelect from '../components/billing/CustomerSelect';
import PaymentModal from '../components/billing/PaymentModal';
import HeldBillsModal from '../components/billing/HeldBillsModal';
import DiscountModal from '../components/billing/DiscountModal';
import BillCompletedModal from '../components/billing/BillCompletedModal';
import {
  createBill,
  holdBill as holdBillAPI,
  listHeldBills,
  resumeBill as resumeBillAPI,
} from '../service/salesService';

const BillingPage = () => {
  const { user, settings } = useAuthStore();
  const isDarkMode = settings.general.theme === 'dark';
  const {
    currentBill,
    addProductToBill,
    removeItemFromBill,
    updateItemQuantity,
    updateItemDiscount,
    applyDiscount,
    setCustomer,
    clearBill,
    resumeHeldBill,
  } = usePOSStore();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [completedBill, setCompletedBill] = useState<Bill | null>(null);
  const [heldBillsData, setHeldBillsData] = useState<Bill[]>([]);
  const [resumedBill, setResumedBill] = useState<Bill | null>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const itemDiscountTotal = currentBill.items.reduce((sum, item) => sum + Number(item.discount || 0), 0);

  const handleProductSelect = (product: Product) => {
    const result = addProductToBill(product, 1);
    if (!result.ok && result.message) {
      toast.error(result.message);
    }
  };

  const handleCustomerSelect = (customer: Customer | null) => {
    setCustomer(customer);
  };

  const handleHoldBill = async () => {
    if (!user || currentBill.items.length === 0) return;

    try {
      const payload = {
        customer_id: currentBill.customerId || null,
        notes: currentBill.notes || '',
        points_to_redeem: currentBill.pointsToRedeem || 0,
        items: currentBill.items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          discount_rate: item.discountRate || 0,
        })),
      };

      const createdBill = await createBill(payload);
      await holdBillAPI(createdBill.id);
      clearBill();
    } catch (error) {
      console.error('Failed to hold bill:', error);
    }
  };

  const handleNewBill = () => {
    setCompletedBill(null);
    clearBill();
  };

  const handleApplyDiscount = (amount: number, isPercentage: boolean) => {
    applyDiscount(amount, isPercentage);
  };

  const loadHeldBills = async () => {
    try {
      const bills = await listHeldBills();
      setHeldBillsData(bills);
      setShowHeldBillsModal(true);
    } catch (err) {
      console.error('Failed to load held bills:', err);
    }
  };

  const handleResumeBill = async (billId: number) => {
    try {
      const bill = await resumeBillAPI(billId);
      setResumedBill(bill);
      resumeHeldBill(bill);
      setShowHeldBillsModal(false);
      setShowPaymentModal(true);
    } catch (err) {
      console.error('Failed to resume held bill:', err);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      if (event.key === 'F2') {
        event.preventDefault();
        productSearchRef.current?.focus();
        productSearchRef.current?.select();
        return;
      }

      if (event.key === 'F7') {
        event.preventDefault();
        if (currentBill.items.length > 0) setShowDiscountModal(true);
        return;
      }

      if (event.key === 'F8') {
        event.preventDefault();
        if (currentBill.items.length > 0) void handleHoldBill();
        return;
      }

      if (event.key === 'F9') {
        event.preventDefault();
        if (currentBill.items.length > 0) setShowPaymentModal(true);
        return;
      }

      if (isCtrlOrMeta && key === 'n') {
        event.preventDefault();
        handleNewBill();
        return;
      }

      if (event.key === 'Escape') {
        if (showPaymentModal) setShowPaymentModal(false);
        else if (showDiscountModal) setShowDiscountModal(false);
        else if (showHeldBillsModal) setShowHeldBillsModal(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentBill.items.length, showPaymentModal, showDiscountModal, showHeldBillsModal]);

  return (
    <div className={`h-full ${isDarkMode ? 'dark' : ''}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Billing
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create and manage customer bills
          </p>
        </div>
        <button
          data-testid="billing-held-bills"
          onClick={loadHeldBills}
          className="flex items-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <RotateCcw size={18} className="mr-2" />
          Held Bills
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-4rem)]">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b dark:border-gray-700">
            <ProductSearch onSelectProduct={handleProductSelect} inputRef={productSearchRef} />
          </div>

          <BillItemsList
            items={currentBill.items}
            updateQuantity={updateItemQuantity}
            updateDiscount={updateItemDiscount}
            removeItem={removeItemFromBill}
          />

          {currentBill.items.length > 0 && (
            <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex flex-col sm:flex-row justify-between space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  data-testid="billing-hold-bill"
                  onClick={handleHoldBill}
                  disabled={currentBill.items.length === 0}
                  className={`flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg ${
                    currentBill.items.length === 0
                      ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                      : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <PauseCircle size={18} className="mr-2" />
                  Hold Bill
                </button>

                <button
                  data-testid="billing-proceed-payment"
                  onClick={() => setShowPaymentModal(true)}
                  disabled={currentBill.items.length === 0}
                  className={`flex items-center justify-center py-2 px-4 rounded-lg ${
                    currentBill.items.length === 0
                      ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                      : 'text-white bg-primary-600 dark:bg-primary-500 hover:bg-primary-700 dark:hover:bg-primary-600'
                  }`}
                >
                  <CreditCard size={18} className="mr-2" />
                  Proceed to Payment
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
              Bill Summary
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Customer
              </label>
              <CustomerSelect
                selectedCustomerId={currentBill.customerId}
                selectedCustomerName={currentBill.customerName}
                onSelectCustomer={handleCustomerSelect}
              />
            </div>
          </div>

          <div className="flex-grow">
            {currentBill.items.length > 0 ? (
              <>
                <div className="border-b dark:border-gray-700 pb-3 mb-3">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>Items:</span>
                    <span>{currentBill.items.length}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Quantities:</span>
                    <span>
                      {currentBill.items.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                      )}
                    </span>
                  </div>
                </div>

                <BillSummary
                  subtotal={currentBill.subtotal}
                  taxTotal={currentBill.taxTotal}
                  itemDiscountTotal={itemDiscountTotal}
                  discount={currentBill.discount}
                  total={currentBill.total}
                />

                <div className="mt-4 space-y-2">
                  {currentBill.discount > 0 ? (
                    <>
                      <button
                        onClick={() => setShowDiscountModal(true)}
                        className="flex items-center justify-center w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Percent size={18} className="mr-2" />
                        Change Discount
                      </button>
                      <button
                        onClick={() => handleApplyDiscount(0, false)}
                        className="flex items-center justify-center w-full py-2 px-4 border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                      >
                        <Percent size={18} className="mr-2" />
                        Remove Discount
                      </button>
                    </>
                  ) : (
                    <button
                      data-testid="billing-apply-discount"
                      onClick={() => setShowDiscountModal(true)}
                      className="flex items-center justify-center w-full py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Percent size={18} className="mr-2" />
                      Apply Discount
                    </button>
                  )}

                  <button
                    data-testid="billing-pay-button"
                    onClick={() => setShowPaymentModal(true)}
                    className="flex items-center justify-center w-full py-2 px-4 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600"
                  >
                    <CreditCard size={18} className="mr-2" />
                    Pay ₹{currentBill.total.toFixed(2)}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <div className="h-16 w-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
                  <PlusCircle size={32} />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  No items in bill
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                  Search and add products to create a bill
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal
          total={resumedBill ? parseFloat(resumedBill.total) : currentBill.total}
          subtotal={resumedBill ? parseFloat(resumedBill.subtotal || '0') : currentBill.subtotal}
          taxTotal={resumedBill ? parseFloat(resumedBill.tax_total || '0') : currentBill.taxTotal}
          itemDiscountTotal={resumedBill
            ? (Array.isArray(resumedBill.items)
                ? resumedBill.items.reduce((sum: number, item: any) => sum + parseFloat(item.discount_amount || '0'), 0)
                : 0)
            : itemDiscountTotal}
          customerId={resumedBill?.customer ?? currentBill.customerId ?? null}
          items={
            resumedBill
              ? resumedBill.items.map((item) => ({
                  id: item.id,
                  productId: item.product,
                  productName: item.product_name,
                  quantity: parseFloat(item.quantity),
                  price: parseFloat(item.price),
                  taxRate: parseFloat(item.tax_rate),
                  taxAmount: parseFloat(item.tax_amount),
                  discountRate: parseFloat(item.discount_rate),
                  discountAmount: parseFloat(item.discount_amount),
                  total: parseFloat(item.total),
                }))
              : currentBill.items
          }
          discount={resumedBill ? parseFloat(resumedBill.discount) : currentBill.discount}
          pointsToRedeem={resumedBill?.points_redeemed ?? currentBill.pointsToRedeem ?? 0}
          resumedBillId={resumedBill?.id}
          onClose={() => {
            setShowPaymentModal(false);
            setResumedBill(null);
          }}
          onComplete={(bill) => {
            setShowPaymentModal(false);
            setResumedBill(null);
            clearBill();
            setCompletedBill(bill);
          }}
        />
      )}

      {showHeldBillsModal && (
        <HeldBillsModal
          heldBills={heldBillsData}
          onClose={() => setShowHeldBillsModal(false)}
          onResume={handleResumeBill}
        />
      )}

      {showDiscountModal && (
        <DiscountModal
          subtotal={currentBill.subtotal}
          onClose={() => setShowDiscountModal(false)}
          onApply={handleApplyDiscount}
        />
      )}

      {completedBill && (
        <BillCompletedModal
          bill={completedBill}
          onClose={() => setCompletedBill(null)}
          onNewBill={handleNewBill}
        />
      )}
    </div>
  );
};

export default BillingPage;
