import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type ButtonVariant } from './buttonStyles'

export function Button({ variant, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />
}
