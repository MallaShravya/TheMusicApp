import { buildSparks, makeSparkStates, sparkPhase, sparkRate, SPARK_COUNT } from '../sparks';

const BASE = { centreX: 260, baseY: 338, width: 22, height: 212 };

function frame(states: ReturnType<typeof makeSparkStates>, time: number, energy: number) {
  return buildSparks({ states, time, energy, ...BASE });
}

describe('sparks always rise', () => {
  /**
   * The reported bug: sparks fell back toward the wood whenever the music quietened. They were
   * positioned from the fire's *current* energy, so a drop in loudness shortened the flight of
   * every spark already in the air.
   */
  it('never moves a spark downward when the energy collapses mid-flight', () => {
    const states = makeSparkStates();
    const previousY: number[] = [];
    const previousCycle: number[] = [];
    const offenders: string[] = [];

    for (let step = 0; step < 400; step += 1) {
      const time = step / 60;
      // Loud for the first half second, then near silence — the exact shape that broke it.
      const energy = time < 0.5 ? 1 : 0.18;

      frame(states, time, energy).forEach((spark, i) => {
        // Only compare within one flight; a relaunch legitimately returns to the base.
        const sameFlight = states[i].cycle === previousCycle[i];
        if (sameFlight && previousY[i] !== undefined && spark.cy > previousY[i] + 1e-9) {
          offenders.push(
            `spark ${i} fell from ${previousY[i].toFixed(2)} to ${spark.cy.toFixed(2)} at t=${time.toFixed(2)}`,
          );
        }
        previousY[i] = spark.cy;
        previousCycle[i] = states[i].cycle;
      });
    }

    expect(offenders).toEqual([]);
  });

  it('rises monotonically at steady energy too', () => {
    const states = makeSparkStates();
    let previous: number[] = [];
    let previousCycle: number[] = [];
    const offenders: string[] = [];

    for (let step = 0; step < 300; step += 1) {
      const sparks = frame(states, step / 60, 0.7);
      sparks.forEach((spark, i) => {
        if (previous[i] !== undefined && states[i].cycle === previousCycle[i]) {
          if (spark.cy > previous[i] + 1e-9) offenders.push(`spark ${i} fell`);
        }
        previous[i] = spark.cy;
        previousCycle[i] = states[i].cycle;
      });
    }

    expect(offenders).toEqual([]);
  });

  it('captures the energy once per flight, not every frame', () => {
    const states = makeSparkStates();
    frame(states, 0, 1);
    const launched = states.map((s) => s.launchEnergy);

    // Energy collapses, but nothing already in flight should notice.
    frame(states, 0.01, 0);
    expect(states.map((s) => s.launchEnergy)).toEqual(launched);
  });

  it('reads a new energy when a spark relaunches', () => {
    const states = makeSparkStates();
    frame(states, 0, 1);
    const first = states[0].launchEnergy;

    // One full loop of spark 0 puts it past its next launch.
    const period = 1 / sparkRate(0);
    frame(states, period + 0.01, 0.25);
    expect(states[0].launchEnergy).not.toBe(first);
    expect(states[0].launchEnergy).toBe(0.25);
  });

  it('starts every spark at the wood and never above the peak budget', () => {
    const states = makeSparkStates();
    for (let step = 0; step < 600; step += 1) {
      for (const spark of frame(states, step / 60, 1)) {
        expect(spark.cy).toBeLessThanOrEqual(BASE.baseY + 1e-9);
        expect(spark.cy).toBeGreaterThanOrEqual(BASE.baseY - BASE.height);
      }
    }
  });

  it('emits only finite, drawable numbers even when fed nonsense', () => {
    const states = makeSparkStates();
    for (const sparks of [frame(states, NaN, 1), frame(states, 1, NaN), frame(states, 2, Infinity)]) {
      for (const spark of sparks) {
        expect(Number.isFinite(spark.cx)).toBe(true);
        expect(Number.isFinite(spark.cy)).toBe(true);
        expect(Number.isFinite(spark.r)).toBe(true);
        expect(spark.r).toBeGreaterThanOrEqual(0);
        expect(spark.opacity).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives each spark its own schedule so they do not pulse together', () => {
    const phases = new Set(Array.from({ length: SPARK_COUNT }, (_, i) => sparkPhase(i)));
    expect(phases.size).toBe(SPARK_COUNT);
  });
});
