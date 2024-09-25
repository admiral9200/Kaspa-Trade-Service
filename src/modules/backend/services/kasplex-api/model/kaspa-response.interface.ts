export interface IKaspaResponse<T> {
  message?: string;
  prev: string;
  next: string;
  result: T;
}
