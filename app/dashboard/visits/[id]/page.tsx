import { VisitDetails } from '@/components/visits/visit-details';

export default function VisitPage({ params }: { params: { id: string } }) {
  return <VisitDetails visitId={params.id} />;
}
