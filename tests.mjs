import assert from 'node:assert/strict';
import { DriveThruSimulator, computeScoreboard } from './simulation.mjs';

function runTicks(sim, seconds) {
  for (let i = 0; i < seconds; i += 1) sim.tick(1);
}

function moveLane1CarToOrder(sim) {
  sim.addCar(1);
  runTicks(sim, 2);
  assert.equal(sim.carAt('order1')?.lane, 1, 'Lane 1 car should reach order1 after 2 seconds');
}

function completeSingleLane1Car(sim, opts = {}) {
  moveLane1CarToOrder(sim);
  runTicks(sim, opts.orderTime ?? 5);
  sim.releaseStation('order1');
  sim.tick(1); // move to 1 gap to cash, total starts here
  runTicks(sim, opts.toCash ?? 1);
  assert.equal(sim.carAt('cash')?.lane, 1, 'Lane 1 car should reach cash after one gap');
  runTicks(sim, opts.cashTime ?? 5);
  sim.releaseStation('cash');
  sim.tick(1); // move to gap to present
  runTicks(sim, 1);
  assert.equal(sim.carAt('present')?.lane, 1, 'Car should reach present after one gap');
  runTicks(sim, opts.presentTime ?? 5);
  sim.releaseStation('present');
  sim.tick(1);
  assert.equal(sim.completedCars.length, 1, 'Car should complete after leaving present');
  return sim.completedCars[0];
}

function testSpawnAndMovement() {
  const sim = new DriveThruSimulator();
  sim.addCar(1);
  assert.equal(sim.carAt('lane1_pre2')?.lane, 1);
  sim.tick(1);
  assert.equal(sim.carAt('lane1_pre1')?.lane, 1, 'Car should move one space per second');
  sim.tick(1);
  assert.equal(sim.carAt('order1')?.lane, 1, 'Car should reach order after second move');
  assert.equal(sim.carAt('order1').totalStartedAt, null, 'Total must not start while at order');
}

function testTotalStartsAfterOrderLeaves() {
  const sim = new DriveThruSimulator();
  moveLane1CarToOrder(sim);
  runTicks(sim, 3);
  sim.releaseStation('order1');
  sim.tick(1);
  const car = sim.carAt('gap_cash1');
  assert.ok(car, 'Released order car should move into shared gap');
  assert.equal(car.totalStartedAt, sim.now, 'Total should start when the car physically leaves order');
}

function testBlockedOrderTimerContinues() {
  const sim = new DriveThruSimulator();
  // Car A sits at cash and blocks the path onward.
  moveLane1CarToOrder(sim);
  sim.releaseStation('order1');
  sim.tick(1); // gap_cash1
  sim.tick(1); // cash
  assert.equal(sim.carAt('cash')?.lane, 1, 'Car A should be sitting at cash');

  // Car B sits at gap_cash1 because cash is blocked.
  sim.addCar(2);
  runTicks(sim, 2);
  sim.releaseStation('order2');
  sim.tick(1); // gap_cash2
  sim.tick(1); // gap_cash1
  assert.equal(sim.carAt('gap_cash1')?.lane, 2, 'Car B should be sitting at the shared 1-gap-to-cash');

  // Car C reaches order1 and is released, but cannot move because gap_cash1 is occupied.
  sim.addCar(1);
  runTicks(sim, 2);
  const third = sim.carAt('order1');
  runTicks(sim, 2);
  sim.releaseStation('order1');
  const enteredAt = third.positionEnteredAt;
  sim.tick(1);
  assert.equal(sim.carAt('order1')?.id, third.id, 'Blocked order car should stay at order');
  runTicks(sim, 3);
  assert.equal(sim.now - enteredAt >= 5, true, 'Order timer should continue while the car waits');

  // Once cash is released and the chain clears, the waiting order car should finally move.
  sim.releaseStation('cash');
  sim.tick(1); // the chain starts clearing
  sim.tick(1); // by now the waiting order car must have moved out
  const moved = sim.activeCars.find((car) => car.id === third.id);
  assert.notEqual(moved?.position, 'order1', 'Order car should move once the path clears');
  assert.ok(moved.totalStartedAt != null, 'Total should start when it actually moves out of order');
  assert.ok(moved.totalStartedAt > enteredAt, 'Total start time should be later than the time it entered order');
}

function testLane2HasTwoGapsToCash() {
  const sim = new DriveThruSimulator();
  sim.addCar(2);
  runTicks(sim, 2);
  assert.equal(sim.carAt('order2')?.lane, 2);
  sim.releaseStation('order2');
  sim.tick(1);
  assert.equal(sim.carAt('gap_cash2')?.lane, 2, 'Lane 2 should first move to 2-gap-to-cash');
  sim.tick(1);
  assert.equal(sim.carAt('gap_cash1')?.lane, 2, 'Lane 2 should then move to 1-gap-to-cash');
  sim.tick(1);
  assert.equal(sim.carAt('cash')?.lane, 2, 'Lane 2 should then reach cash');
}

function testMergePriorityByFirstCompletedOrder() {
  const sim = new DriveThruSimulator();

  // Car A reaches cash and blocks it.
  moveLane1CarToOrder(sim);
  sim.releaseStation('order1');
  sim.tick(1); // gap_cash1
  sim.tick(1); // cash
  assert.equal(sim.carAt('cash')?.lane, 1);

  // Car B reaches the shared 1-gap-to-cash and waits because cash is blocked.
  sim.addCar(1);
  runTicks(sim, 2);
  sim.releaseStation('order1');
  sim.tick(1); // gap_cash1
  assert.equal(sim.carAt('gap_cash1')?.lane, 1);

  // Car C (Lane 2) completes order first and waits at gap_cash2.
  sim.addCar(2);
  runTicks(sim, 2);
  sim.releaseStation('order2');
  sim.tick(1); // gap_cash2
  const lane2Car = sim.carAt('gap_cash2');
  assert.equal(lane2Car?.lane, 2);

  // Car D (Lane 1) completes order later and waits at order1.
  sim.addCar(1);
  runTicks(sim, 2);
  sim.releaseStation('order1');
  const lane1Waiting = sim.carAt('order1');
  assert.equal(lane1Waiting?.lane, 1);

  // When cash is released, the shared gap opens. Car C should take it first because it completed order earlier.
  sim.releaseStation('cash');
  sim.tick(1);
  assert.equal(sim.carAt('gap_cash1')?.id, lane2Car.id, 'Earlier completed order should take the shared 1-gap-to-cash first');
}

function testCompletedCarsOnlyAffectAverages() {
  const sim = new DriveThruSimulator();
  const completed = completeSingleLane1Car(sim, { orderTime: 10, cashTime: 8, presentTime: 7 });
  // Add another active car that should not affect averages.
  sim.addCar(1);
  runTicks(sim, 2);
  const scoreboard = computeScoreboard(sim.completedCars);
  assert.equal(scoreboard.order1.avg, completed.timings.order1);
  assert.equal(scoreboard.cash.avg, completed.timings.cash);
  assert.equal(scoreboard.total.avg, completed.timings.total);
  assert.equal(scoreboard.order1.pct, completed.timings.order1 <= 30 ? 100 : 0);
}

function testThresholdEvents() {
  const sim = new DriveThruSimulator();
  moveLane1CarToOrder(sim);
  sim.releaseStation('order1');
  sim.tick(1); // total starts
  let sawYellow = false;
  let sawRed = false;
  for (let i = 0; i < 95; i += 1) {
    const events = sim.tick(1);
    if (events.some((event) => event.type === 'yellow-threshold')) sawYellow = true;
    if (events.some((event) => event.type === 'red-threshold')) sawRed = true;
  }
  assert.equal(sawYellow, true, 'Yellow threshold should trigger at 1 minute total');
  assert.equal(sawRed, true, 'Red threshold should trigger at 1:30 total');
}

function runAll() {
  testSpawnAndMovement();
  testTotalStartsAfterOrderLeaves();
  testBlockedOrderTimerContinues();
  testLane2HasTwoGapsToCash();
  testMergePriorityByFirstCompletedOrder();
  testCompletedCarsOnlyAffectAverages();
  testThresholdEvents();
  console.log('All simulation tests passed.');
}

runAll();
