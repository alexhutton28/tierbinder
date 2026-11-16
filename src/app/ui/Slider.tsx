'use client';

import React from 'react';
import styles from './Slider.module.css';

// A notched slider: it picks one of a few `values`, evenly spaced along its track with a
// notch at each, its name over it as a subheader (.tierbinder-caption). The browser's own
// range input underneath, restyled, so the arrows, Home and End and screen readers work as
// they do on any slider; they hear `describe(value)` rather than the notch's number.

export default function Slider({
  label,
  values,
  value,
  describe,
  onChange,
}: {
  label: string;
  // In order, lowest first
  values: readonly number[];
  value: number;
  // What a value is called, for screen readers ("170 pixels wide")
  describe: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const id = React.useId();
  // The notch nearest the value, should it not be one of them
  const index = values.reduce(
    (best, v, i) => (Math.abs(v - value) < Math.abs(values[best] - value) ? i : best),
    0
  );
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <label htmlFor={id} className="tierbinder-caption self-start">
        {label}
      </label>
      <div className={styles.box}>
        <div aria-hidden className={styles.notches}>
          {values.map((v) => (
            <span key={v} className={styles.notch} />
          ))}
        </div>
        <input
          id={id}
          type="range"
          className={styles.input}
          min={0}
          max={values.length - 1}
          step={1}
          value={index}
          aria-valuetext={describe(values[index])}
          onChange={(e) => onChange(values[Number(e.target.value)])}
        />
      </div>
    </div>
  );
}
