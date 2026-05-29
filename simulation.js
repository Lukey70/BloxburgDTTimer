(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DriveThruTimer = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_TARGETS = Object.freeze({
    order1: 30,
    order2: 30,
    cash: 30,
    present: 30,
    total: 60
  });

  const POSITIONS = Object.freeze({
    l1_pre2: { label: "Lane 1 Spawn", lane: 1, next: "l1_pre1", x: 8, y: 62, type: "space" },
    l1_pre1: { label: "Lane 1 Pre-Order", lane: 1, next: "l1_order", x: 21, y: 62, type: "space" },
    l1_order: { label: "Order 1", lane: 1, next: "l1_gap1", x: 34, y: 62, type: "order", metric: "order1" },
    l1_gap1: { label: "Lane 1 Gap", lane: 1, next: "cash", x: 50, y: 62, type: "gap" },

    l2_pre2: { label: "Lane 2 Spawn", lane: 2, next: "l2_pre1", x: 8, y: 82, type: "space" },
    l2_pre1: { label: "Lane 2 Pre-Order", lane: 2, next: "l2_order", x: 21, y: 82, type: "space" },
    l2_order: { label: "Order 2", lane: 2, next: "l2_gap2", x: 34, y: 82, type: "order", metric: "order2" },
    l2_gap2: { label: "Lane 2 Gap 2", lane: 2, next: "l2_gap1", x: 42, y: 74, type: "gap" },
    l2_gap1: { label: "Lane 2 Gap 1", lane: 2, next: "cash", x: 50, y: 66, type: "gap" },

    cash: { label: "Cash", lane: null, next: "cash_gap", x: 66, y: 52, type: "cash", metric: "cash" },
    cash_gap: { label: "Cash → Present Gap", lane: null, next: "present", x: 78, y: 52, type: "gap" },
    present: { label: "Present", lane: null, next: "exit", x: 92, y: 52, type: "present", metric: "present" }
  });

  const POSITION_ORDER = Object.freeze(Object.keys(POSITIONS));
  const BEFORE_CASH_POSITIONS = new Set(["l1_order", "l1_gap1", "l2_order", "l2_gap2", "l2_gap1"]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function underTargetPercent(values, target) {
    if (!values.length) return 0;
    const under = values.filter((value) => value <= target).length;
    return Math.round((under / values.length) * 100);
  }

  function createInitialState() {
    return {
      nextCarId: 1,
      releaseSeq: 0,
      targets: clone(DEFAULT_TARGETS),
      cars: [],
      completed: []
    };
  }

  class DriveThruSimulation {
    constructor(savedState) {
      this.state = createInitialState();
      this.events = [];

      if (savedState && typeof savedState === "object") {
        this.state = Object.assign(createInitialState(), clone(savedState));
        this.state.targets = Object.assign(clone(DEFAULT_TARGETS), savedState.targets || {});
        this.state.cars = Array.isArray(savedState.cars) ? savedState.cars : [];
        this.state.completed = Array.isArray(savedState.completed) ? savedState.completed : [];
      }
    }

    exportState() {
      return clone(this.state);
    }

    emit(type, payload) {
      this.events.push(Object.assign({ type }, payload || {}));
    }

    consumeEvents() {
      const events = this.events.slice();
      this.events.length = 0;
      return events;
    }

    carAt(position) {
      return this.state.cars.find((car) => car.position === position) || null;
    }

    isFree(position) {
      return position === "exit" || !this.carAt(position);
    }

    addCar(lane, now) {
      const position = lane === 1 ? "l1_pre2" : "l2_pre2";
      if (!this.isFree(position)) {
        this.emit("blocked", { message: `Lane ${lane} entry is full.` });
        return null;
      }

      const car = {
        id: this.state.nextCarId++,
        lane,
        position,
        enteredAt: now,
        positionEnteredAt: now,
        orderReady: false,
        cashReady: false,
        presentReady: false,
        orderCompletedAt: null,
        orderReleaseSeq: null,
        totalStartedAt: null,
        yellowSoundPlayed: false,
        redSoundPlayed: false,
        metrics: {}
      };

      this.state.cars.push(car);
      this.emit("laneEntry", { lane, carId: car.id });
      this.emit("status", { message: `Car #${car.id} entered Lane ${lane}.` });
      return car;
    }

    releaseOrder(lane, now) {
      const position = lane === 1 ? "l1_order" : "l2_order";
      const car = this.carAt(position);
      if (!car) {
        this.emit("blocked", { message: `No car is at Order ${lane}.` });
        return false;
      }

      if (!car.orderReady) {
        const metric = lane === 1 ? "order1" : "order2";
        car.metrics[metric] = now - car.positionEnteredAt;
        car.orderReady = true;
        car.orderCompletedAt = now;
        car.orderReleaseSeq = ++this.state.releaseSeq;
        this.emit("status", { message: `Car #${car.id} completed Order ${lane}. It will move when the path is clear.` });
      }

      return true;
    }

    releaseCash(now) {
      const car = this.carAt("cash");
      if (!car) {
        this.emit("blocked", { message: "No car is at Cash." });
        return false;
      }

      if (!car.cashReady) {
        car.metrics.cash = now - car.positionEnteredAt;
        car.cashReady = true;
        this.emit("status", { message: `Car #${car.id} completed Cash. It will move when the path is clear.` });
      }

      return true;
    }

    releasePresent(now) {
      const car = this.carAt("present");
      if (!car) {
        this.emit("blocked", { message: "No car is at Present." });
        return false;
      }

      if (!car.presentReady) {
        car.metrics.present = now - car.positionEnteredAt;
        car.presentReady = true;
        this.emit("status", { message: `Car #${car.id} completed Present. It will leave the drive thru.` });
      }

      return true;
    }

    canMoveByTime(car, now) {
      return now - car.positionEnteredAt >= 1;
    }

    canLeaveCurrentPosition(car) {
      const def = POSITIONS[car.position];
      if (!def) return false;
      if (def.type === "order") return car.orderReady;
      if (def.type === "cash") return car.cashReady;
      if (def.type === "present") return car.presentReady;
      return true;
    }

    hasEarlierReleasedCarBeforeCash(car) {
      if (!car.orderReleaseSeq) return false;
      return this.state.cars.some((other) => {
        if (other.id === car.id) return false;
        if (!other.orderReleaseSeq) return false;
        if (!BEFORE_CASH_POSITIONS.has(other.position)) return false;
        return other.orderReleaseSeq < car.orderReleaseSeq;
      });
    }

    moveCar(car, to, now) {
      const from = car.position;

      if (to === "exit") {
        car.metrics.total = car.totalStartedAt == null ? 0 : now - car.totalStartedAt;
        car.finishedAt = now;
        this.state.cars = this.state.cars.filter((existing) => existing.id !== car.id);
        this.state.completed.unshift(car);
        this.state.completed = this.state.completed.slice(0, 250);
        this.emit("completed", { carId: car.id, lane: car.lane, total: car.metrics.total });
        this.emit("status", { message: `Car #${car.id} left Present and was counted as completed.` });
        return true;
      }

      car.position = to;
      car.positionEnteredAt = now;

      if ((from === "l1_order" || from === "l2_order") && car.totalStartedAt == null) {
        car.totalStartedAt = now;
        this.emit("totalStarted", { carId: car.id, lane: car.lane });
      }

      this.emit("moved", { carId: car.id, lane: car.lane, from, to });
      return true;
    }

    tryMove(from, now, movedIds) {
      const car = this.carAt(from);
      if (!car || movedIds.has(car.id)) return false;
      const def = POSITIONS[from];
      if (!def) return false;
      const to = def.next;

      if (!this.canMoveByTime(car, now)) return false;
      if (!this.canLeaveCurrentPosition(car)) return false;
      if (!this.isFree(to)) return false;
      if (to === "cash" && this.hasEarlierReleasedCarBeforeCash(car)) return false;

      this.moveCar(car, to, now);
      movedIds.add(car.id);
      return true;
    }

    tryMoveToCash(now, movedIds) {
      if (!this.isFree("cash")) return false;
      const candidates = [this.carAt("l1_gap1"), this.carAt("l2_gap1")]
        .filter(Boolean)
        .filter((car) => !movedIds.has(car.id))
        .filter((car) => this.canMoveByTime(car, now))
        .filter((car) => !this.hasEarlierReleasedCarBeforeCash(car))
        .sort((a, b) => (a.orderReleaseSeq || 999999) - (b.orderReleaseSeq || 999999));

      if (!candidates.length) return false;
      const car = candidates[0];
      this.moveCar(car, "cash", now);
      movedIds.add(car.id);
      return true;
    }

    tick(now) {
      const movedIds = new Set();

      // Downstream first, then upstream. Each car may move one space per tick.
      this.tryMove("present", now, movedIds);
      this.tryMove("cash_gap", now, movedIds);
      this.tryMove("cash", now, movedIds);
      this.tryMoveToCash(now, movedIds);
      this.tryMove("l2_gap2", now, movedIds);
      this.tryMove("l1_order", now, movedIds);
      this.tryMove("l2_order", now, movedIds);
      this.tryMove("l1_pre1", now, movedIds);
      this.tryMove("l2_pre1", now, movedIds);
      this.tryMove("l1_pre2", now, movedIds);
      this.tryMove("l2_pre2", now, movedIds);

      this.checkThresholds(now);
      return movedIds.size;
    }

    checkThresholds(now) {
      for (const car of this.state.cars) {
        if (car.totalStartedAt == null) continue;
        const total = now - car.totalStartedAt;

        if (total >= 60 && !car.yellowSoundPlayed) {
          car.yellowSoundPlayed = true;
          this.emit("thresholdYellow", { carId: car.id, lane: car.lane, total });
        }

        if (total >= 90 && !car.redSoundPlayed) {
          car.redSoundPlayed = true;
          this.emit("thresholdRed", { carId: car.id, lane: car.lane, total, repeat: 2 });
        }
      }
    }

    getCarColour(car, now) {
      if (car.totalStartedAt == null) return "green";
      const total = now - car.totalStartedAt;
      if (total >= 90) return "red";
      if (total >= 60) return "yellow";
      return "green";
    }

    activeTotalSeconds(car, now) {
      if (car.totalStartedAt == null) return 0;
      return now - car.totalStartedAt;
    }

    valuesFor(metric) {
      return this.state.completed
        .map((car) => car.metrics[metric])
        .filter((value) => Number.isFinite(value));
    }

    getBoardStats() {
      const targets = this.state.targets;
      const metrics = ["order1", "order2", "cash", "present", "total"];
      const result = {};

      for (const metric of metrics) {
        const values = this.valuesFor(metric);
        result[metric] = {
          average: average(values),
          percent: underTargetPercent(values, targets[metric]),
          count: values.length
        };
      }

      return result;
    }
  }

  return {
    DriveThruSimulation,
    DEFAULT_TARGETS,
    POSITIONS,
    POSITION_ORDER
  };
});
