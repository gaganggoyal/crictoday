import Link from "next/link";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-[#176B43] text-white hover:bg-[#105535]",
  orange: "bg-[#D85F25] text-white hover:bg-[#A84316]",
  outline: "border border-line bg-surface text-foreground hover:bg-background",
  ghost: "text-foreground hover:bg-surface",
  danger: "bg-[#8C2F1B] text-white hover:bg-[#6E2414]",
} as const;

type Variant = keyof typeof variants;

export function Button({
  href,
  variant = "primary",
  className,
  children,
  ...props
}: {
  href?: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  const classes = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    className,
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
