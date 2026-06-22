import { $t } from '@/locales';
/**
 * Transform record to option
 *
 * @example
 *   ```ts
 *   const record = {
 *     key1: 'label1',
 *     key2: 'label2'
 *   };
 *   const options = transformRecordToOption(record);
 *   // [
 *   //   { value: 'key1', label: 'label1' },
 *   //   { value: 'key2', label: 'label2' }
 *   // ]
 *   ```;
 *
 * @param record
 */
export function transformRecordToOption(record) {
  return Object.entries(record).map(([value, label]) => ({
    value,
    label
  }));
}
/**
 * Translate options
 *
 * @param options
 */
export function translateOptions(options) {
  return options.map(option => ({
    ...option,
    label: $t(option.label)
  }));
}
/**
 * Toggle html class
 *
 * @param className
 */
export function toggleHtmlClass(className) {
  function add() {
    document.documentElement.classList.add(className);
  }
  function remove() {
    document.documentElement.classList.remove(className);
  }
  return {
    add,
    remove
  };
}
