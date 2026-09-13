export interface ClassDetailTabDef<T extends string = string> {
  readonly key: T;
  readonly label: string;
}

interface Props<T extends string> {
  readonly tabs: readonly ClassDetailTabDef<T>[];
  readonly active: T;
  readonly onChange: (key: T) => void;
}

/** Thin wrapper around the .tabs/.tab/.tab--on pattern Events.tsx already uses for its review-
 *  status filter — same visual language, reused here for the class detail page's section
 *  navigation instead of a filter. Shared by the Admin and teacher detail pages, which show
 *  different tab sets (Admin gets an extra Teachers tab). */
export default function ClassDetailTabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <nav className="tabs dashboard-enter stagger-1" aria-label="Class sections">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`tab${active === tab.key ? ' tab--on' : ''}`}
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
