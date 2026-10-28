import { db } from "../db";
import { generateId, nowIso, parseJson } from "../utils";
import type { Simulation, SimulationContext, SimulationStep } from "../../types/models";

type SimulationRow = Omit<Simulation, "steps" | "context"> & { steps: string; context: string };

function toSimulation(row: SimulationRow): Simulation {
  return {
    ...row,
    status: row.status === "finished" ? "finished" : "in_progress",
    steps: parseJson<SimulationStep[]>(row.steps, []),
    context: parseJson<SimulationContext>(row.context, { model: "", generatedAt: row.createdAt, sources: [] }),
  };
}

export const simulationsRepository = {
  list: (uid: string) => {
    const rows = db
      .prepare("SELECT * FROM simulations WHERE uid = ? ORDER BY updatedAt DESC")
      .all(uid) as SimulationRow[];
    return rows.map(toSimulation);
  },

  get: (uid: string, id: string) => {
    const row = db.prepare("SELECT * FROM simulations WHERE uid = ? AND id = ?").get(uid, id) as
      | SimulationRow
      | undefined;
    return row ? toSimulation(row) : null;
  },

  create: (uid: string, payload: { title: string; steps: SimulationStep[]; context: SimulationContext }) => {
    const id = generateId();
    const now = nowIso();
    db.prepare(
      `INSERT INTO simulations (id, uid, title, status, currentStep, steps, context, createdAt, updatedAt)
      VALUES (?, ?, ?, 'in_progress', 0, ?, ?, ?, ?)`,
    ).run(id, uid, payload.title, JSON.stringify(payload.steps), JSON.stringify(payload.context), now, now);
    return simulationsRepository.get(uid, id)!;
  },

  update: (
    uid: string,
    id: string,
    changes: Partial<Pick<Simulation, "title" | "status" | "currentStep" | "steps">>,
  ) => {
    const current = simulationsRepository.get(uid, id);
    if (!current) return null;
    const steps = changes.steps ?? current.steps;
    const currentStep = Math.max(0, Math.min(changes.currentStep ?? current.currentStep, steps.length));
    db.prepare(
      "UPDATE simulations SET title = ?, status = ?, currentStep = ?, steps = ?, updatedAt = ? WHERE uid = ? AND id = ?",
    ).run(
      changes.title ?? current.title,
      changes.status ?? current.status,
      currentStep,
      JSON.stringify(steps),
      nowIso(),
      uid,
      id,
    );
    return simulationsRepository.get(uid, id);
  },

  delete: (uid: string, id: string) => {
    db.prepare("DELETE FROM simulations WHERE uid = ? AND id = ?").run(uid, id);
  },
};
