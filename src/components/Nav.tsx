import Button from "./Button";

export interface NavItem<T extends string = string> {
    id: T;
    label: string;
}

interface NavProps<T extends string = string> {
    items: readonly NavItem<T>[];
    currentView: T;
    onSelectView: (view: T) => void;
    ariaLabel?: string;
    className?: string;
}

export default function Nav<T extends string = string>({
    items,
    currentView,
    onSelectView,
    ariaLabel = "Navigation",
    className = "",
}: NavProps<T>) {
    return (
        <nav aria-label={ariaLabel} className={`flex items-center gap-1.5 rounded-full bg-[#e8e8ed] p-1 ${className}`}>
            {items.map((item) => {
                const isActive = currentView === item.id;

                return (
                    <Button
                        key={item.id}
                        type="button"
                        variant={isActive ? "primary" : "ghost"}
                        className={`!min-h-7 !px-3 !py-1 !text-xs font-medium transition-colors ${
                            isActive
                                ? "!bg-white !text-[#1d1d1f] shadow-sm hover:!bg-white"
                                : "!text-[#6e6e73] hover:!text-[#1d1d1f] hover:!bg-transparent"
                        }`}
                        onClick={() => onSelectView(item.id)}
                    >
                        {item.label}
                    </Button>
                );
            })}
        </nav>
    );
}

// Backward-compatible AdminNav wrapper
export type AdminView = "wall" | "admin";

const adminNavItems: readonly NavItem<AdminView>[] = [
    {
        id: "wall",
        label: "Wall",
    },
    {
        id: "admin",
        label: "Administration",
    },
] as const;

export function AdminNav({
    currentView,
    onSelectView,
}: {
    currentView: AdminView;
    onSelectView: (view: AdminView) => void;
}) {
    return (
        <Nav<AdminView>
            items={adminNavItems}
            currentView={currentView}
            onSelectView={onSelectView}
            ariaLabel="Admin views"
        />
    );
}
