import MobileTaskDetail from '@/components/mobile/tasks/MobileTaskDetail';

export default async function MobileTaskDetailPage({ params }: { params: Promise<{ projectId: string; taskId: string }> }) {
  const { projectId, taskId } = await params;
  return <MobileTaskDetail projectId={projectId} taskId={taskId} />;
}
