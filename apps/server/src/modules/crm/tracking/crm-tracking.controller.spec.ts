import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { IS_PUBLIC_KEY } from '../../auth/auth.decorators';
import { CrmTrackingController } from './crm-tracking.controller';

test('CrmTrackingController exposes the open pixel route without login', () => {
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, getMethod(CrmTrackingController, 'open')), true);
});

function getMethod(controller: { prototype: object }, method: string) {
  const value = Reflect.get(controller.prototype, method);

  assert.equal(typeof value, 'function');

  return value;
}
