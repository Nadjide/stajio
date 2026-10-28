import { Buffer } from "node:buffer";
import process from "node:process";
import { AccountError, isValidNewPassword, PASSWORD_REQUIREMENT } from "../src/server/account-credentials.mjs";
import { inspectRecoveryTarget, resetLocalPassword } from "../src/server/account-recovery.mjs";

const usage = "Usage : npm run account:reset-password -- --db <base-existante.db> --email <adresse> [--stdin]";

function parseArguments(values) {
  const options = { databasePath: process.env.STAJIO_DB_PATH, email: undefined, stdin: false };
  const seen = new Set();
  for (let index = 0; index < values.length; index++) {
    const flag = values[index];
    if (!["--db", "--email", "--stdin"].includes(flag) || seen.has(flag)) throw new AccountError(usage);
    seen.add(flag);
    if (flag === "--stdin") options.stdin = true;
    else {
      const value = values[++index];
      if (!value || value.startsWith("--")) throw new AccountError(usage);
      if (flag === "--db") options.databasePath = value;
      else options.email = value;
    }
  }
  if (!options.databasePath || !options.email) throw new AccountError(usage);
  return options;
}

function readHiddenLine(prompt) {
  process.stdout.write(prompt);
  const previousRaw = Boolean(process.stdin.isRaw);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(error) {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(previousRaw);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }
    function onData(chunk) {
      for (const char of chunk) {
        if (char === "\u0003" || char === "\u0004") return finish(new AccountError("Réinitialisation annulée."));
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f" || char === "\b") value = Array.from(value).slice(0, -1).join("");
        else if (char >= " " && char !== "\u007f") value += char;
        if (Buffer.byteLength(value, "utf8") > 1024) return finish(new AccountError(PASSWORD_REQUIREMENT));
      }
    }
    process.stdin.on("data", onData);
  });
}

async function readPassword(stdinMode) {
  let password;
  let confirmation;
  if (stdinMode) {
    if (process.stdin.isTTY)
      throw new AccountError("--stdin est réservé à un flux d'entrée protégé, sans terminal interactif.");
    process.stdin.setEncoding("utf8");
    let input = "";
    for await (const chunk of process.stdin) {
      input += chunk;
      if (Buffer.byteLength(input, "utf8") > 2048) throw new AccountError(PASSWORD_REQUIREMENT);
    }
    const lines = input.replace(/\r\n/g, "\n").split("\n");
    if (lines.at(-1) === "") lines.pop();
    if (lines.length !== 2)
      throw new AccountError(
        "Le flux --stdin doit contenir exactement deux lignes : le nouveau mot de passe et sa confirmation.",
      );
    [password, confirmation] = lines;
  } else {
    if (!process.stdin.isTTY || !process.stdout.isTTY)
      throw new AccountError(
        "Un terminal interactif est nécessaire pour la saisie cachée. Pour un outil local de confiance, utilise --stdin.",
      );
    password = await readHiddenLine("Nouveau mot de passe (saisie cachée) : ");
    confirmation = await readHiddenLine("Confirme le nouveau mot de passe (saisie cachée) : ");
  }
  if (password !== confirmation) throw new AccountError("Les deux mots de passe ne correspondent pas.");
  if (!isValidNewPassword(password)) throw new AccountError(PASSWORD_REQUIREMENT);
  return password;
}

try {
  const options = parseArguments(process.argv.slice(2));
  const databasePath = inspectRecoveryTarget(options.databasePath, options.email);
  console.log(`Base sélectionnée : ${databasePath}`);
  console.log(`Compte sélectionné : ${options.email}`);
  const password = await readPassword(options.stdin);
  const result = await resetLocalPassword(databasePath, options.email, password);
  console.log("Mot de passe réinitialisé. Toutes les anciennes sessions de ce compte sont révoquées.");
  if (result.backupPath) console.log(`Sauvegarde avant migration : ${result.backupPath}`);
} catch (error) {
  console.error(
    error instanceof AccountError
      ? error.message
      : "Réinitialisation impossible. Vérifie le chemin, les droits d'accès et que la base sélectionnée est une base Stajio existante.",
  );
  process.exitCode = 1;
}
