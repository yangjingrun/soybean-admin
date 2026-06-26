import { isMissingModelConfigError } from './error-message';

export type RequestBusinessError = {
  type: 'missing-model-config';
  message: string;
};

type RequestBusinessErrorHandler = (error: RequestBusinessError) => boolean | void;

let requestBusinessErrorHandler: RequestBusinessErrorHandler | null = null;

/** Registers the global UI handler for actionable backend business errors. */
export function setRequestBusinessErrorHandler(handler: RequestBusinessErrorHandler | null) {
  requestBusinessErrorHandler = handler;
}

/** Dispatches actionable backend business errors to the registered global handler. */
export function handleRequestBusinessError(message: string) {
  if (!isMissingModelConfigError(message)) {
    return false;
  }

  return requestBusinessErrorHandler?.({ type: 'missing-model-config', message }) === true;
}
