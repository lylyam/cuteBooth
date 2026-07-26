import type { ButtonHTMLAttributes, ReactNode } from 'react';
import buttonStyle from './Button.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

function Button({ children, className, ...props }: ButtonProps) {
  return (
    <button className={className ? `${buttonStyle.button} ${className}` : buttonStyle.button} {...props}>
      {children}
    </button>
  );
}

export default Button;
