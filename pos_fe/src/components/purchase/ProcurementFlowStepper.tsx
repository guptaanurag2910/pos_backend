import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type StepState = {
  done: boolean;
  optional?: boolean;
};

interface ProcurementFlowStepperProps {
  currentStep: 1 | 2 | 3 | 4;
  steps?: {
    po: StepState;
    grn: StepState;
    pi: StepState;
    payment: StepState;
  };
  showScenarioActions?: boolean;
  contextIds?: {
    poId?: number | null;
    grnId?: number | null;
    invoiceId?: number | null;
    paymentId?: number | null;
  };
}

const defaultSteps = {
  po: { done: false, optional: true },
  grn: { done: false, optional: true },
  pi: { done: false, optional: false },
  payment: { done: false, optional: false },
};

const ProcurementFlowStepper = ({
  currentStep,
  steps = defaultSteps,
  showScenarioActions = false,
  contextIds,
}: ProcurementFlowStepperProps) => {
  const navigate = useNavigate();
  const poId = contextIds?.poId || null;
  const grnId = contextIds?.grnId || null;
  const invoiceId = contextIds?.invoiceId || null;
  const paymentId = contextIds?.paymentId || null;

  const goToStep = (stepNumber: 1 | 2 | 3 | 4) => {
    if (stepNumber === 1) {
      if (poId) {
        navigate(`/purchase-orders/${poId}`);
        return;
      }
      navigate('/purchase/orders');
      return;
    }

    if (stepNumber === 2) {
      if (grnId) {
        const suffix = poId ? `?po=${poId}` : '';
        navigate(`/grns/${grnId}${suffix}`);
        return;
      }
      if (poId) {
        navigate(`/grns/new?po=${poId}`);
        return;
      }
      navigate('/purchase/grn');
      return;
    }

    if (stepNumber === 3) {
      if (invoiceId) {
        const params = new URLSearchParams();
        params.set('edit', String(invoiceId));
        if (poId) params.set('po', String(poId));
        if (grnId) params.set('grn', String(grnId));
        navigate(`/purchase/invoices?${params.toString()}`);
        return;
      }
      if (grnId) {
        const params = new URLSearchParams();
        params.set('grn', String(grnId));
        if (poId) params.set('po', String(poId));
        navigate(`/purchase/invoices?${params.toString()}`);
        return;
      }
      if (poId) {
        navigate(`/purchase/invoices?po=${poId}`);
        return;
      }
      navigate('/purchase/invoices');
      return;
    }

    if (paymentId) {
      const params = new URLSearchParams();
      params.set('edit', String(paymentId));
      if (poId) params.set('po', String(poId));
      if (invoiceId) params.set('invoice', String(invoiceId));
      navigate(`/purchase/payments?${params.toString()}`);
      return;
    }
    if (invoiceId) {
      const params = new URLSearchParams();
      params.set('invoice', String(invoiceId));
      if (poId) params.set('po', String(poId));
      navigate(`/purchase/payments?${params.toString()}`);
      return;
    }
    if (poId) {
      navigate(`/purchase/payments?po=${poId}`);
      return;
    }
    navigate('/purchase/payments');
  };

  const stepList = [
    { key: 'po', label: 'Step 1 PO', state: steps.po },
    { key: 'grn', label: 'Step 2 GRN', state: steps.grn },
    { key: 'pi', label: 'Step 3 PI', state: steps.pi },
    { key: 'payment', label: 'Step 4 Payment', state: steps.payment },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2">
        {stepList.map((step, idx) => (
          <div key={step.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToStep((idx + 1) as 1 | 2 | 3 | 4)}
              className="inline-flex items-center gap-2 rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-700"
              title={`Go to ${step.label}`}
            >
              {step.state.done ? (
                <CheckCircle2 size={18} className="text-green-600" />
              ) : (
                <Circle size={18} className={idx + 1 === currentStep ? 'text-blue-600' : 'text-gray-400'} />
              )}
              <span
                className={`text-sm font-medium ${
                  idx + 1 === currentStep ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {step.label}
                {step.state.optional ? ' (Optional)' : ''}
              </span>
            </button>
            {idx < stepList.length - 1 && <ArrowRight size={14} className="text-gray-400" />}
          </div>
        ))}
      </div>

      {showScenarioActions && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/purchase-orders/new')}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            Standard: Start with PO
          </button>
          <button
            type="button"
            onClick={() => navigate('/grns/new?mode=direct_receipt')}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Direct Receipt: Start with GRN
          </button>
          <button
            type="button"
            onClick={() => navigate('/purchase/invoices?mode=direct_invoice')}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Direct Invoice: Start with PI
          </button>
        </div>
      )}
    </div>
  );
};

export default ProcurementFlowStepper;
