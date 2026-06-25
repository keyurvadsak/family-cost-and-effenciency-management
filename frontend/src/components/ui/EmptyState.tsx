import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

export default function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon size={40} />
      <p>{message}</p>
    </div>
  );
}
