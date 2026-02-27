import { type ReactNode } from "react";
import { FadeIn } from "./fade-in";
import { BlurText } from "./blur-text";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <FadeIn className="flex flex-col items-center justify-center py-16 px-4 text-center" direction="up" duration={500}>
      <div className="mb-4 text-muted-foreground/50 [&_svg]:w-16 [&_svg]:h-16">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-1">
        <BlurText text={title} delay={100} />
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        <BlurText text={description} delay={200} />
      </p>
      {action && <FadeIn delay={400}>{action}</FadeIn>}
    </FadeIn>
  );
}
