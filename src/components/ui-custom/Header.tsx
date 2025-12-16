import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
  centered?: boolean;
}

const Header = ({
  title,
  subtitle,
  children,
  className,
  actions,
  centered = false,
}: HeaderProps) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 mb-6",
        centered ? "items-center text-center" : "items-start",
        className
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src="https://cdn.jsdelivr.net/gh/packtypebot/imagens/evolution-logo.png"
            alt="Evolution API Logo"
            className="h-8 w-auto"
          />
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {subtitle && (
        <p className="text-sm text-muted-foreground max-w-3xl mt-1">
          {subtitle}
        </p>
      )}
      {children && <div className="mt-4 w-full">{children}</div>}
    </div>
  );
};

export default Header;
