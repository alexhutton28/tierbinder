import type { ComponentProps } from 'react';
import styles from './Button.module.css';

// TierBinder's buttons; tools show as selected from aria-pressed. An icon button is
// square and holds only its icon, so it needs an aria-label (and a title for the tooltip).
// A quiet button is an icon button with no box, muted until hovered (a tier's remove).
// A text button is just its words (and any icon beside them), brightening on hover.
// A large button is a section's closing action on phones: a touch target tall below b7
// (its parent decides its width), a control's height from b7 up.
const VARIANTS = {
  default: '',
  primary: styles.primary,
  tool: styles.tool,
  icon: styles.icon,
  quiet: `${styles.icon} ${styles.quiet}`,
  text: styles.text,
};

const SIZES = { default: '', large: styles.large };

type Props = ComponentProps<'button'> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export default function Button({
  variant = 'default',
  size = 'default',
  className = '',
  ...props
}: Props) {
  const classes = [styles.button, VARIANTS[variant], SIZES[size], className]
    .filter(Boolean)
    .join(' ');
  return <button {...props} className={classes} />;
}
