import { icons, LucideProps } from "lucide-react";

interface DynamicIconProps extends LucideProps {
  name: string;
}

export function LucideIcon({ name, ...props }: DynamicIconProps) {
  const pascalName = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("") as keyof typeof icons;

  const Icon = icons[pascalName];
  if (!Icon) return null;
  return <Icon {...props} />;
}
