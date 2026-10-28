import Database from "better-sqlite3";
import { constants, copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

// Recovery creates a separate file; the live database is never overwritten.
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--backup" || args[2] !== "--output") {
  console.error("Usage : npm run db:recover -- --backup <sauvegarde.sqlite> --output <nouvelle-base.db>");
  process.exitCode = 1;
} else {
  try {
    const source = path.resolve(args[1]);
    const destination = path.resolve(args[3]);
    if (
      source === destination ||
      [destination, `${destination}-wal`, `${destination}-shm`, `${destination}-journal`].some(existsSync)
    ) {
      throw new Error("La destination doit être un nouveau fichier ; aucune base existante ne sera remplacée.");
    }
    if (existsSync(`${source}-wal`) || existsSync(`${source}-journal`)) {
      throw new Error("Utilise une sauvegarde autonome du dossier backups, sans fichier WAL/journal associé.");
    }
    const snapshot = new Database(source, { readonly: true, fileMustExist: true });
    try {
      if (snapshot.pragma("integrity_check", { simple: true }) !== "ok") {
        throw new Error("La sauvegarde SQLite est endommagée.");
      }
      if (!snapshot.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()) {
        throw new Error("Ce fichier n'est pas une sauvegarde de base Stajio.");
      }
      mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      copyFileSync(source, destination, constants.COPYFILE_EXCL);
    } finally {
      snapshot.close();
    }
    console.log(`Copie récupérée : ${destination}`);
    console.log(
      "Application arrêtée, sélectionne cette copie avec STAJIO_DB_PATH et une version de Stajio compatible.",
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Récupération impossible.");
    process.exitCode = 1;
  }
}
