import type { ComponentProps } from 'react';

// TierBinder's buttons. The styles are the .tierbinder-button rules in globals.css;
// tools show as selected from aria-pressed.
const VARIANTS = {
  default: '',
  primary: 'primary',
  tool: 'tierbinder-tool',
};

type Props = ComponentProps<'button'> & { variant?: keyof typeof VARIANTS };

export default function Button({ variant = 'default', className = '', ...props }: Props) {
  const classes = ['tierbinder-button', VARIANTS[variant], className].filter(Boolean).join(' ');
  return <button {...props} className={classes} />;
}
