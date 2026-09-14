import type { CompletionAward } from "../domain/rewards";

export type TodoStatus = "active" | "standby" | "completed";

export type TodoRecord = {
  id: string;
  text: string;
  status: TodoStatus;
  creationOrder: number;
  completionOrder: number | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
};

export type CompletionAwardRecord = CompletionAward;

export type CoreMetaRecord = {
  key: "core";
  createdAt: number;
  rulesVersion: 1;
  nextCreationOrder: number;
  nextCompletionOrder: number;
};

export type DerivedStatsMetaRecord = {
  key: "derived-stats";
  lifetimeXp: number;
  awardCount: number;
};

export type MetaRecord = CoreMetaRecord | DerivedStatsMetaRecord;
