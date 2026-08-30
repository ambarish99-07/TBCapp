interface Props<T extends string> {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Small pill-track toggle — e.g. switching a chart between Monthly/Weekly/Today. Generic over
 * the option keys so each call site keeps its own literal union type. */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className="inline-flex rounded-lg bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
            value === option.key ? "bg-text text-white" : "text-muted hover:text-text"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
