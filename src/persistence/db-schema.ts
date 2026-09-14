import type { DBSchema } from "idb";
import type { CompletionAwardRecord, MetaRecord, TodoRecord, TodoStatus } from "./models";

export interface MechaTodoDatabase extends DBSchema {
  todos: {
    key: string;
    value: TodoRecord;
    indexes: {
      "by-status-creation-order": [TodoStatus, number, string];
      "by-status-completion-order": [TodoStatus, number, string];
      "by-creation-order": number;
      "by-completion-order": number;
    };
  };
  completionAwards: {
    key: string;
    value: CompletionAwardRecord;
    indexes: {
      "by-day-key": string;
      "by-awarded-at": number;
      "by-day-ordinal": [string, number];
    };
  };
  meta: {
    key: MetaRecord["key"];
    value: MetaRecord;
  };
}
