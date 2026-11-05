// Domain errors carry an HTTP status and a stable machine-readable code.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly fields?: string[],
  ) {
    super(code);
    this.name = "AppError";
  }
}
