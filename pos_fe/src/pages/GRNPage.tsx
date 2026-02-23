import { useParams } from 'react-router-dom';
import GRNFormPage from '../components/grn/GRNFormPage';

const GRNPage = () => {
  const { grnId } = useParams();

  return <GRNFormPage grnId={grnId && grnId !== 'new' ? parseInt(grnId) : undefined} />;
};

export default GRNPage;
