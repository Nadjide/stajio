import { db } from "../db";
import { generateId, nowIso, parseJson } from "../utils";
import type { Report, ReportBrief, ReportProvenance, ReportSection, ReportVersion } from "../../types/models";

type ReportRow = {
  id: string;
  title: string;
  brief: string;
  sections: string;
  status: string;
  provenance: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
};

type VersionRow = {
  id: string;
  reportId: string;
  label: string;
  title: string;
  sections: string;
  createdAt: string;
};

function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    title: row.title,
    brief: parseJson<ReportBrief>(row.brief, {
      guidelines: "",
      problem: "",
      targetLength: "",
      periodStart: "",
      periodEnd: "",
      sourceLogIds: [],
    }),
    sections: parseJson<ReportSection[]>(row.sections, []),
    status: row.status === "validated" ? "validated" : "draft",
    provenance: parseJson<ReportProvenance | null>(row.provenance, null),
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    validatedAt: row.validatedAt,
  };
}

function toVersion(row: VersionRow): ReportVersion {
  return { ...row, sections: parseJson<ReportSection[]>(row.sections, []) };
}

export class ReportConflictError extends Error {
  constructor(readonly current: Report) {
    super("Le rapport a été modifié ailleurs.");
  }
}

export const reportsRepository = {
  list: (uid: string) => {
    const rows = db.prepare("SELECT * FROM reports WHERE uid = ? ORDER BY updatedAt DESC").all(uid) as ReportRow[];
    return rows.map(toReport);
  },

  get: (uid: string, id: string) => {
    const row = db.prepare("SELECT * FROM reports WHERE uid = ? AND id = ?").get(uid, id) as ReportRow | undefined;
    return row ? toReport(row) : null;
  },

  create: (uid: string, payload: { title: string; brief: ReportBrief; sections: ReportSection[] }) => {
    const id = generateId();
    const now = nowIso();
    db.prepare(
      `INSERT INTO reports (id, uid, title, brief, sections, status, provenance, revision, createdAt, updatedAt, validatedAt)
      VALUES (?, ?, ?, ?, ?, 'draft', NULL, 1, ?, ?, NULL)`,
    ).run(id, uid, payload.title, JSON.stringify(payload.brief), JSON.stringify(payload.sections), now, now);
    return reportsRepository.get(uid, id)!;
  },

  /** Optimistic concurrency: a stale tab cannot overwrite newer corrections. */
  update: (
    uid: string,
    id: string,
    revision: number,
    payload: {
      title: string;
      brief: ReportBrief;
      sections: ReportSection[];
      status: "draft" | "validated";
      provenance?: ReportProvenance | null;
    },
  ) => {
    return db
      .transaction(() => {
        const current = reportsRepository.get(uid, id);
        if (!current) return null;
        if (current.revision !== revision) throw new ReportConflictError(current);
        const now = nowIso();
        const validatedAt = payload.status === "validated" ? (current.validatedAt ?? now) : null;
        db.prepare(
          `UPDATE reports SET title = ?, brief = ?, sections = ?, status = ?, provenance = ?, revision = revision + 1,
          updatedAt = ?, validatedAt = ? WHERE uid = ? AND id = ?`,
        ).run(
          payload.title,
          JSON.stringify(payload.brief),
          JSON.stringify(payload.sections),
          payload.status,
          JSON.stringify(payload.provenance === undefined ? current.provenance : payload.provenance),
          now,
          validatedAt,
          uid,
          id,
        );
        return reportsRepository.get(uid, id);
      })
      .immediate();
  },

  delete: (uid: string, id: string) => {
    db.prepare("DELETE FROM reports WHERE uid = ? AND id = ?").run(uid, id);
  },

  listVersions: (uid: string, reportId: string) => {
    const rows = db
      .prepare("SELECT * FROM report_versions WHERE uid = ? AND reportId = ? ORDER BY createdAt DESC, id DESC")
      .all(uid, reportId) as VersionRow[];
    return rows.map(toVersion);
  },

  getVersion: (uid: string, reportId: string, versionId: string) => {
    const row = db
      .prepare("SELECT * FROM report_versions WHERE uid = ? AND reportId = ? AND id = ?")
      .get(uid, reportId, versionId) as VersionRow | undefined;
    return row ? toVersion(row) : null;
  },

  /** Snapshot what is stored, not what a client claims to have. */
  createVersion: (uid: string, reportId: string, label: string) => {
    const report = reportsRepository.get(uid, reportId);
    if (!report) return null;
    const id = generateId();
    db.prepare(
      "INSERT INTO report_versions (id, uid, reportId, label, title, sections, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, uid, reportId, label, report.title, JSON.stringify(report.sections), nowIso());
    return reportsRepository.getVersion(uid, reportId, id);
  },

  restoreVersion: (uid: string, reportId: string, versionId: string, revision: number) => {
    return db
      .transaction(() => {
        const report = reportsRepository.get(uid, reportId);
        const version = reportsRepository.getVersion(uid, reportId, versionId);
        if (!report || !version) return null;
        if (report.revision !== revision) throw new ReportConflictError(report);
        reportsRepository.createVersion(uid, reportId, `Avant restauration de « ${version.label} »`.slice(0, 200));
        return reportsRepository.update(uid, reportId, revision, {
          title: version.title,
          brief: report.brief,
          sections: version.sections,
          status: "draft",
        });
      })
      .immediate();
  },
};
