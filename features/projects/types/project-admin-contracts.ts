export interface ProjectControlsData {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: "planning" | "active" | "risk" | "hold" | "complete";
  readonly version: number;
  readonly clientVisible: boolean;
  readonly memberIds: readonly string[];
  readonly leadId: string | null;
  readonly color: string;
  readonly icon: string;
  readonly position: number;
  readonly teamId: string | null;
  readonly startDate: string | null;
  readonly dueDate: string | null;
}

export interface EmployeeOption {
  readonly id: string;
  readonly name: string;
}

export interface TeamOption {
  readonly id: string;
  readonly name: string;
}
