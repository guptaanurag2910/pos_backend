// routes/PurchaseOrderPage.tsx
import { useParams } from 'react-router-dom';
import PurchaseOrderFormPage from '../components/purchase-order/PurchaseOrderFormPage';

const PurchaseOrderPage = () => {
  const { poId } = useParams();

  return <PurchaseOrderFormPage poId={poId && poId !== 'new' ? parseInt(poId) : undefined} />;
};

export default PurchaseOrderPage;
