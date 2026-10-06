import { getDatabase } from "../database/connection";
import { SessionHistoryRepository } from "./SessionHistoryRepository";

let repo: SessionHistoryRepository | null = null;

export function getSessionHistory(): SessionHistoryRepository {
  if (!repo) repo = new SessionHistoryRepository(getDatabase());
  return repo;
}

export function resetSessionHistoryForTests(): void {
  repo = null;
}
