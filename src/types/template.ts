export enum PageSize {
  A4 = "A4",
  Letter = "Letter",
}

export interface Template {
  id: string;
  name: string;
  pageSize: PageSize;
}
