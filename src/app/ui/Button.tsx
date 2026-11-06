import type { ComponentProps } from 'react';

// tcgTierStack's buttons. The styles are the .tier-stack-button rules in globals.css;
// tools show as selected from aria-pressed.
const VARIANTS = {
  default: '',
  primary: 'primary',
  ghost: 'ghost',
  tool: 'tier-stack-tool',
};

type Props = ComponentProps<'button'> & { variant?: keyof typeof VARIANTS };

export default function Button({ variant = 'default', className = '', ...props }: Props) {
  const classes = ['tier-stack-button', VARIANTS[variant], className].filter(Boolean).join(' ');
  return <button {...props} className={classes} />;
}
