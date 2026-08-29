import * as Avatar from '@radix-ui/react-avatar';
import * as Checkbox from '@radix-ui/react-checkbox';
import * as Dialog from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import * as Select from '@radix-ui/react-select';
import * as Tabs from '@radix-ui/react-tabs';
import * as Toast from '@radix-ui/react-toast';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'ghost' }
>(function Button({ className = '', tone = 'primary', type = 'button', ...props }, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`pm-button pm-button--${tone} ${className}`}
    />
  );
});
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input {...props} ref={ref} className={`pm-input ${className}`} />;
  },
);
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = '', ...props }, ref) {
  return <textarea {...props} ref={ref} className={`pm-input pm-textarea ${className}`} />;
});
export function Badge({ children }: { children: ReactNode }) {
  return <span className="pm-badge">{children}</span>;
}
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="pm-kbd">{children}</kbd>;
}
export function Combobox({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `${label.replaceAll(/\s+/g, '-').toLowerCase()}-options`;
  return (
    <label className="pm-combobox">
      <span>{label}</span>
      <input
        aria-label={label}
        list={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <datalist id={id}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </label>
  );
}
export { Avatar, Checkbox, Dialog, Menu, Popover, Select, Tabs, Toast, Tooltip };
