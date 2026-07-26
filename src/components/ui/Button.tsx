import type { ButtonHTMLAttributes, ReactNode } from 'react';
import butonStyle from './Button.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

function Button({ children, ...props }: ButtonProps) {
  return (
    <button className={butonStyle.button} {...props}>
      {children}
    </button>
  );
}

export default Button;
