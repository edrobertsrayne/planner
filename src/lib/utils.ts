import { clsx, type ClassValue } from 'clsx';

// Joins class names, dropping falsy ones. Conflicts are not resolved: a component's own styles
// sit in the `components` layer, so a utility passed in `class` wins by layer order.
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
