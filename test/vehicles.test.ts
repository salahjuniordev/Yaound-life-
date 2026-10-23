import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, getTravelPlan } from '../src/sim/engine';
import { migrateState } from '../src/sim/state';
import { FLEET_RIDERS, VEHICLE_MAP, VEHICLES, fleetEstimate, vehicleRepairCost, vehicleResaleValue } from '../src/data/vehicles';
import { makeState } from './helpers';

const MOTO = VEHICLE_MAP['moto_jiancheng'];

test('buying a vehicle checks money and driving skill, then adds a fuelled vehicle', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = MOTO.price + 1000;

  assert.equal(engine.dispatch({ type: 'vehicle_buy', modelId: MOTO.id }).ok, false, 'driving skill required');
  state.player.skills.driving = MOTO.drivingRequirement;

  state.wallet.cash = MOTO.price - 1000;
  assert.equal(engine.dispatch({ type: 'vehicle_buy', modelId: MOTO.id }).ok, false, 'cannot afford');

  state.wallet.cash = MOTO.price + 1000;
  assert.equal(engine.dispatch({ type: 'vehicle_buy', modelId: MOTO.id }).ok, true);
  assert.equal(state.vehicles.length, 1);
  assert.equal(state.vehicles[0].condition, 100);
  assert.equal(state.vehicles[0].fuel, MOTO.tankLitres * 0.5);
  assert.ok(state.achievements.includes('first_wheels'));
});

test('own vehicle adds a travel option that burns fuel and condition instead of fare', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.player.skills.driving = 5;
  state.wallet.cash = MOTO.price + 100000;
  assert.equal(engine.dispatch({ type: 'vehicle_buy', modelId: MOTO.id }).ok, true);
  const vehicle = state.vehicles[0];
  const cashBefore = state.wallet.cash;
  const fuelBefore = vehicle.fuel;

  const plan = getTravelPlan(state, 'mokolo', 'mvog_mbi');
  const quote = plan.options.find((o) => o.mode === 'vehicle');
  assert.ok(quote, 'vehicle option exists');
  assert.equal(quote.available, true);
  assert.ok((quote.fuelLitres ?? 0) > 0);
  assert.equal(quote.cost, 0);

  assert.equal(engine.dispatch({ type: 'travel', to: 'mvog_mbi', mode: 'vehicle', vehicleId: vehicle.id }).ok, true);
  assert.equal(state.player.district, 'mvog_mbi');
  assert.equal(state.wallet.cash, cashBefore, 'no fare paid');
  assert.ok(vehicle.fuel < fuelBefore, 'fuel consumed');
  assert.ok(vehicle.condition < 100, 'condition worn');
  assert.equal(vehicle.trips, 1);
  assert.equal(state.travelLog[0].mode, 'vehicle');
});

test('assigned fleet moto is unavailable for personal trips until recalled', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.player.skills.driving = 5;
  state.wallet.cash = MOTO.price + 100000;
  assert.equal(engine.dispatch({ type: 'vehicle_buy', modelId: MOTO.id }).ok, true);
  const vehicle = state.vehicles[0];

  assert.equal(engine.dispatch({ type: 'vehicle_assign_rider', vehicleId: vehicle.id, riderId: FLEET_RIDERS[0].id }).ok, true);
  let quote = getTravelPlan(state, 'mokolo', 'mvog_mbi').options.find((o) => o.mode === 'vehicle');
  assert.equal(quote?.available, false);
  assert.equal(engine.dispatch({ type: 'travel', to: 'mvog_mbi', mode: 'vehicle', vehicleId: vehicle.id }).ok, false);

  assert.equal(engine.dispatch({ type: 'vehicle_assign_rider', vehicleId: vehicle.id, riderId: null }).ok, true);
  quote = getTravelPlan(state, 'mokolo', 'mvog_mbi').options.find((o) => o.mode === 'vehicle');
  assert.equal(quote?.available, true);
});

test('one rider cannot take two motos', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.player.skills.driving = 5;
  state.wallet.cash = MOTO.price * 3;
  assert.equal(engine.dispatch({ type: 'vehicle_buy', modelId: MOTO.id }).ok, true);
  assert.equal(engine.dispatch({ type: 'vehicle_buy', modelId: MOTO.id }).ok, true);
  const [a, b] = state.vehicles;
  assert.equal(engine.dispatch({ type: 'vehicle_assign_rider', vehicleId: a.id, riderId: FLEET_RIDERS[0].id }).ok, true);
  assert.equal(engine.dispatch({ type: 'vehicle_assign_rider', vehicleId: b.id, riderId: FLEET_RIDERS[0].id }).ok, false);
});

test('refuel fills the tank, repair restores condition, sell removes the vehicle', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.player.skills.driving = 5;
  state.wallet.cash = MOTO.price + 200000;
  assert.equal(engine.dispatch({ type: 'vehicle_buy', modelId: MOTO.id }).ok, true);
  const vehicle = state.vehicles[0];

  vehicle.fuel = 0.2;
  const cashBeforeFuel = state.wallet.cash;
  assert.equal(engine.dispatch({ type: 'vehicle_refuel', vehicleId: vehicle.id }).ok, true);
  assert.equal(vehicle.fuel, MOTO.tankLitres);
  assert.ok(state.wallet.cash < cashBeforeFuel);

  vehicle.condition = 40;
  const repair = vehicleRepairCost(MOTO, 40);
  const cashBeforeRepair = state.wallet.cash;
  assert.equal(engine.dispatch({ type: 'vehicle_repair', vehicleId: vehicle.id }).ok, true);
  assert.equal(vehicle.condition, 100);
  assert.equal(state.wallet.cash, cashBeforeRepair - repair);

  const value = vehicleResaleValue(MOTO, 100);
  const cashBeforeSale = state.wallet.cash;
  assert.equal(engine.dispatch({ type: 'vehicle_sell', vehicleId: vehicle.id }).ok, true);
  assert.equal(state.vehicles.length, 0);
  assert.equal(state.wallet.cash, cashBeforeSale + value);
});

test('fleet income is paid on new days, net of rider cut, fuel and upkeep', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.player.skills.driving = 5;
  state.wallet.cash = MOTO.price * 4;
  for (let i = 0; i < 3; i++) {
    assert.equal(engine.dispatch({ type: 'vehicle_buy', modelId: MOTO.id }).ok, true);
    const vehicle = state.vehicles[i];
    assert.equal(engine.dispatch({ type: 'vehicle_assign_rider', vehicleId: vehicle.id, riderId: FLEET_RIDERS[i].id }).ok, true);
  }
  assert.equal(state.vehicles.filter((v) => v.fleetRiderId).length, 3);

  const estimate = fleetEstimate(MOTO, FLEET_RIDERS[1], 100, state.world.fuelPrice);
  assert.ok(estimate.gross > 0);
  assert.ok(estimate.net > 0);
  assert.ok(estimate.net < estimate.gross);

  const ledgerBefore = state.ledger.length;
  const conditionBefore = state.vehicles.map((v) => v.condition);
  for (let day = 2; day <= 12; day++) {
    state.world.day = day;
    state.world.dayOfWeek = day % 7;
    engine.onNewDay();
  }
  const fleetEntries = state.ledger.slice(0, state.ledger.length - ledgerBefore).filter((e) => e.category === 'fleet');
  assert.ok(fleetEntries.length > 0, 'fleet paid at least once');
  assert.ok(fleetEntries.every((e) => e.wallet === 'cash' && e.amount > 0));
  assert.ok(state.vehicles.some((v, i) => v.condition < conditionBefore[i]), 'fleet use wears the motos');
});

test('own moto removes the daily rental fee from moto runs', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.player.skills.driving = 5;
  state.wallet.cash = MOTO.price + 100000;
  assert.equal(engine.dispatch({ type: 'vehicle_buy', modelId: MOTO.id }).ok, true);
  const vehicle = state.vehicles[0];
  vehicle.fuel = 10;

  assert.equal(engine.dispatch({ type: 'moto_run', trips: 1 }).ok, true);
  assert.equal(state.ledger.some((e) => e.counterparty === 'Bike owner'), false);
  assert.ok(vehicle.fuel < 10);
  assert.equal(vehicle.trips, 1);
});

test('legacy saves migrate to an empty garage', () => {
  const legacy = JSON.parse(JSON.stringify(makeState())) as Record<string, unknown>;
  delete legacy.vehicles;
  const migrated = migrateState(legacy);
  assert.ok(migrated);
  assert.deepEqual(migrated.vehicles, []);
});

test('vehicle catalogue keeps distinct models and sane economics', () => {
  assert.equal(new Set(VEHICLES.map((v) => v.id)).size, VEHICLES.length);
  for (const def of VEHICLES) {
    assert.ok(def.price > 0);
    assert.ok(def.tankLitres > 0);
    assert.ok(def.fuelPerDistance > 0);
    assert.ok(def.speed > 0);
    assert.ok(def.resaleRate > 0 && def.resaleRate < 1);
  }
});
