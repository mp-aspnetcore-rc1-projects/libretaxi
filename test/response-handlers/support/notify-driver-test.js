/* eslint-disable no-new */
import test from 'ava';
import NotifyDriver from '../../../src/response-handlers/support/notify-driver';
import { ss } from '../../spec-support';
import Firebase from 'firebase';

test.before(() => {
  // 1 minute from now, which is enough for tests and not enough for side effects
  Firebase.database.ServerValue.TIMESTAMP = (new Date).getTime() + 1 * 60 * 1000;
});

test('can be constructed with default parameters', t => {
  new NotifyDriver();
  t.pass();
});

const loadUser = (user) => {
  const then = (f) => {
    f(user);
  };
  return () => { return { then }; }; // eslint-disable-line arrow-body-style
};

const shouldFail = (t, failReason, user, order) => {
  t.plan(1);
  const successCallback = () => { t.fail(); };
  const failCallback = (reason) => { t.is(reason, failReason); t.end(); };
  const subject = new NotifyDriver({ successCallback, failCallback, loadUser: loadUser(user) });
  subject.call('cli_1', 1, order);
};

test.cb('should not notify driver when order is not new', t => {
  shouldFail(t, 'order is not new', {}, { state: { status: 'old' } });
});

test.cb('should not notify driver when order is stale', t => {
  shouldFail(
    t,
    'order is stale',
    {},
    { state: { status: 'new', createdAt: (new Date).getTime() - 15 * 60 * 1000 } }
  );
});

test.cb('should not notify driver when userType is not \'driver\'', t => {
  shouldFail(
    t,
    'userType is not \'driver\'',
    { state: { userType: 'passenger' } },
    { state: { status: 'new', createdAt: (new Date).getTime() } },
  );
});

test.cb('should not notify driver when driver is muted', t => {
  shouldFail(
    t,
    'driver is muted',
    { state: { userType: 'driver', muted: true } },
    { state: { status: 'new', createdAt: (new Date).getTime() } },
  );
});

test.cb('should not notify driver when vehicle types don\'t match', t => {
  shouldFail(
    t,
    'vehicle types don\'t match',
    { state: { userType: 'driver', vehicleType: 'motorbike' } },
    { state: { status: 'new', requestedVehicleType: 'car', createdAt: (new Date).getTime() } },
  );
});

test.cb('should not notify driver when driver is busy', t => {
  shouldFail(
    t,
    'driver is busy',
    { state: { userType: 'driver', vehicleType: 'car', menuLocation: 'settings' } },
    { state: { status: 'new', requestedVehicleType: 'car', createdAt: (new Date).getTime() } },
  );
});

test.cb('should notify driver when matched', t => {
  t.plan(1);
  const queue = { create: ss.sinon.spy() };
  const successCallback = () => {
    t.truthy(queue.create.calledWith({
      userKey: 'cli_1',
      arg: {
        orderKey: 123,
        distance: 1,
        from: [1, 2],
        to: 'foobar',
        price: 50,
        passengerKey: 'cli_123',
      },
      route: 'driver-order-new',
    }));
    t.end();
  };
  const failCallback = () => { t.fail(); };
  const order = {
    orderKey: 123,
    state: {
      status: 'new',
      requestedVehicleType: 'car',
      passengerLocation: [1, 2],
      passengerDestination: 'foobar',
      price: 50,
      passengerKey: 'cli_123',
      createdAt: (new Date).getTime(),
    },
  };
  const user = { state: { userType: 'driver', vehicleType: 'car', menuLocation: 'driver-index' } };
  const subject = new NotifyDriver({
    successCallback,
    failCallback,
    loadUser: loadUser(user),
    queue,
  });
  subject.call('cli_1', 1, order);
});