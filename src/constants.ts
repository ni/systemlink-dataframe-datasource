import { nbsp } from "utils";

export const decimationMethods = [
  {
    value: 'LOSSY',
    label: 'Lossy',
    description: nbsp`Completes faster but is less accurate`
  },
  {
    value: 'MAX_MIN',
    label: 'Max/min',
    description: nbsp`Preserves spikes and dips`
  },
  {
    value: 'ENTRY_EXIT',
    label: 'Entry/exit',
    description: nbsp`Maintains edges of data (includes max/min)`
  },
];

export const defaultDecimationMethod = 'LOSSY';
