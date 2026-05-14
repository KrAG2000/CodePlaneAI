import fs from "fs";
import path from "path";
import { config } from "../config";
import { ExecutionRecord } from "../types";

const storePath = path.join(config.dataDir, "executions.json");

const ensureStore = (): void => {
  fs.mkdirSync(config.dataDir, { recursive: true });

  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, "[]", "utf8");
  }
};

const readAll = (): ExecutionRecord[] => {
  ensureStore();
  const raw = fs.readFileSync(storePath, "utf8");
  return JSON.parse(raw) as ExecutionRecord[];
};

const writeAll = (records: ExecutionRecord[]): void => {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(records, null, 2), "utf8");
};

export const executionStore = {
  list(): ExecutionRecord[] {
    return readAll();
  },

  get(id: string): ExecutionRecord | undefined {
    return readAll().find((record) => record.id === id);
  },

  save(record: ExecutionRecord): ExecutionRecord {
    const records = readAll();
    const existingIndex = records.findIndex((item) => item.id === record.id);

    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.push(record);
    }

    writeAll(records);
    return record;
  },
};
