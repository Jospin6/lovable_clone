export type Files = Record<string, string>;
export type Plan = { name: string; description: string; techstack: string; features: string[]; files: { path: string; purpose: string }[] };
export type Task = { filepath: string; task_description: string };
export type Message = { role: "user" | "assistant"; content: string };
export type RecentProject = { id: string; name: string; updatedAt: string };
export type Status = "idle" | "loading" | "generating" | "completed" | "cancelled" | "error";
export type StreamEvent =
  | { type: "start"; project_id: string }
  | { type: "stage"; stage: string; message: string; path?: string; step?: number; total?: number }
  | { type: "plan"; plan: Plan }
  | { type: "tasks"; tasks: Task[] }
  | { type: "file" | "file_delta"; path: string; content: string }
  | { type: "task_done"; path: string; step: number; total: number }
  | { type: "done"; project_id: string; files: Files }
  | { type: "error"; message: string };

export type Project = { id: string; name: string; status: Status; history: Message[]; plan?: Plan; files: Files };
