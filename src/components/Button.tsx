import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "ghost" | "icon";
}

const variants = {
    primary: "bg-[#0071e3] text-white hover:bg-[#0077ed]",
    secondary: "bg-[#e8e8ed] text-[#1d1d1f] hover:bg-[#dedee5]",
    danger: "bg-[#fff0ef] text-[#b42318] hover:bg-[#ffe2df]",
    ghost: "bg-transparent text-[#0066cc] hover:bg-[#edf4fc]",
    icon: "bg-transparent text-[#6e6e73] hover:bg-[#e8e8ed]",
};

/** Shared accessible action styles; caller classes supply only layout or specialized canvas positioning. */
export default function Button({ variant = "secondary", className = "", type = "button", ...props }: ButtonProps) {
    return <button type={type} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium leading-tight transition-colors disabled:cursor-default disabled:opacity-50 ${variants[variant]} ${className}`} {...props} />;
}
