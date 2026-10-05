"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import "./ui.css";

// Drop-in for <select>: same <option>/<optgroup> children and the same
// `onChange={(e) => e.target.value}` shape, rendered as a styled listbox.

type Option = { value: string; label: ReactNode; disabled?: boolean; group?: string };
type OptionProps = { value?: string | number; label?: string; disabled?: boolean; children?: ReactNode };

function collect(children: ReactNode, group?: string, out: Option[] = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement<OptionProps>(child)) return;
    if (child.type === "optgroup") collect(child.props.children, child.props.label, out);
    else if (child.type === "option")
      out.push({ value: String(child.props.value ?? ""), label: child.props.children, disabled: child.props.disabled, group });
  });
  return out;
}

const text = (node: ReactNode) => Children.toArray(node).join("").toLowerCase();

type SelectProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  "aria-label"?: string;
};

export function Select({ value, defaultValue, onChange, children, className, style, disabled, required, name, id, ...aria }: SelectProps) {
  const options = collect(children);
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? inner;
  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = options[selectedIndex] ?? options[0];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();
  const optionId = (i: number) => `${listId}-${i}`;

  // Fixed position next to the trigger; the list lives in the top layer, so no ancestor clips it.
  const place = () => {
    const r = button.current!.getBoundingClientRect();
    const el = list.current!;
    const below = innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    el.style.minWidth = `${r.width}px`;
    el.style.left = `${Math.max(8, r.left)}px`;
    el.style.maxHeight = `${Math.min(300, up ? above : below)}px`;
    el.style.top = up ? "auto" : `${r.bottom + 4}px`;
    el.style.bottom = up ? `${innerHeight - r.top + 4}px` : "auto";
  };

  const show = () => {
    if (disabled || open) return;
    place();
    list.current?.showPopover();
  };
  const hide = () => list.current?.hidePopover();

  const choose = (i: number) => {
    const option = options[i];
    if (!option || option.disabled) return;
    if (option.value !== current) {
      setInner(option.value);
      onChange?.({ target: { value: option.value } });
    }
    hide();
  };

  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i;
    return from;
  };

  useEffect(() => {
    if (!open) return;
    const el = list.current!;
    // Keep the list inside the viewport horizontally once its width is known.
    el.style.left = `${Math.max(8, Math.min(el.getBoundingClientRect().left, innerWidth - el.offsetWidth - 8))}px`;
    const onScroll = (e: Event) => e.target !== el && hide();
    addEventListener("scroll", onScroll, true);
    addEventListener("resize", hide);
    return () => {
      removeEventListener("scroll", onScroll, true);
      removeEventListener("resize", hide);
    };
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [open, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const onListKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") e.stopPropagation(); // the popover closes itself; keep modals behind open
    else if (e.key === "ArrowDown") setActive((i) => step(i, 1));
    else if (e.key === "ArrowUp") setActive((i) => step(i, -1));
    else if (e.key === "Home") setActive(step(-1, 1));
    else if (e.key === "End") setActive(step(options.length, -1));
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Tab") return hide();
    else if (e.key.length === 1) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const match = options.findIndex((o) => !o.disabled && text(o.label).startsWith(typed.current.text));
      if (match >= 0) setActive(match);
    } else return;
    e.preventDefault();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        id={id}
        className={`qselect${current === "" ? " qselect--empty" : ""}${className ? ` ${className}` : ""}`}
        style={style}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={aria["aria-label"]}
        popoverTarget={listId}
        onClick={place}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      >
        <span className="qselect__label">{selected?.label}</span>
        <ChevronDown className="qselect__chevron" size={16} aria-hidden />
      </button>
      {(name || required) && (
        // Carries the value for FormData and native `required` validation.
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          required={required}
          value={current}
          onChange={() => {}}
          onFocus={() => button.current?.focus()}
          style={{ position: "absolute", opacity: 0, width: 1, height: 1, padding: 0, border: 0, pointerEvents: "none" }}
        />
      )}
      <ul
        ref={list}
        id={listId}
        popover="auto"
        role="listbox"
        tabIndex={-1}
        className="qselect__list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        onToggle={(e) => {
          const isOpen = e.newState === "open";
          setOpen(isOpen);
          if (isOpen) {
            setActive(selectedIndex >= 0 ? selectedIndex : step(-1, 1));
            list.current?.focus();
          } else if (list.current?.contains(document.activeElement) || document.activeElement === document.body) {
            button.current?.focus();
          }
        }}
        onKeyDown={onListKeyDown}
        // Stop an enclosing <label> from forwarding the click back to the trigger.
        onClick={(e) => e.preventDefault()}
      >
        {options.map((o, i) => (
          <OptionRow
            key={`${o.group ?? ""}:${o.value}:${i}`}
            option={o}
            groupStart={o.group !== undefined && o.group !== options[i - 1]?.group}
            id={optionId(i)}
            selected={i === selectedIndex}
            active={i === active}
            onHover={() => !o.disabled && setActive(i)}
            onChoose={() => choose(i)}
          />
        ))}
      </ul>
    </>
  );
}

function OptionRow({
  option,
  groupStart,
  id,
  selected,
  active,
  onHover,
  onChoose,
}: {
  option: Option;
  groupStart: boolean;
  id: string;
  selected: boolean;
  active: boolean;
  onHover: () => void;
  onChoose: () => void;
}) {
  return (
    <>
      {groupStart && (
        <li role="presentation" className="qselect__group">
          {option.group}
        </li>
      )}
      <li
        id={id}
        role="option"
        aria-selected={selected}
        aria-disabled={option.disabled || undefined}
        className={`qselect__option${active ? " is-active" : ""}${selected ? " is-selected" : ""}`}
        onMouseMove={onHover}
        onClick={onChoose}
      >
        <span>{option.label}</span>
        {selected && <Check size={14} aria-hidden />}
      </li>
    </>
  );
}
