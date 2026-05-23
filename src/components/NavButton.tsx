import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
};

export function NavButton({ icon, label, isActive, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-6 py-2 text-sm font-semibold uppercase tracking-wider transition-colors duration-200 ${
        isActive
          ? "bg-black text-white dark:bg-white dark:text-black"
          : "bg-white text-black hover:bg-black hover:text-white dark:bg-black dark:text-white dark:hover:bg-white dark:hover:text-black"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
