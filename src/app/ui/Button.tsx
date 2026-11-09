import type { ComponentProps } from 'react';
import styles from './Button.module.css';

// TierBinder's buttons; tools show as selected from aria-pressed.
const VARIANTS = {
  default: '',
  primary: styles.primary,
  tool: styles.tool,
};

type Props = ComponentProps<'button'> & { variant?: keyof typeof VARIANTS };

export default function Button({ variant = 'default', className = '', ...props }: Props) {
  const classes = [styles.button, VARIANTS[variant], className].filter(Boolean).join(' ');
  return <button {...props} className={classes} />;
}
