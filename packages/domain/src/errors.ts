export class DomainError extends Error {
  readonly status: 400 | 404 | 409;

  constructor(message: string, status: 400 | 404 | 409 = 409) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
  }
}
