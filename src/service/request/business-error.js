import { isMissingModelConfigError } from './error-message';
let requestBusinessErrorHandler = null;
/** Registers the global UI handler for actionable backend business errors. */
export function setRequestBusinessErrorHandler(handler) {
  requestBusinessErrorHandler = handler;
}
/** Dispatches actionable backend business errors to the registered global handler. */
export function handleRequestBusinessError(message) {
  if (!isMissingModelConfigError(message)) {
    return false;
  }
  return requestBusinessErrorHandler?.({ type: 'missing-model-config', message }) === true;
}
