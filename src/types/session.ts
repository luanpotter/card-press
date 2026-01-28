export interface Card {
  id: string;
  name: string;
  count: number;
  imageId: string;
}

export interface Session {
  id: string;
  name: string;
  templateId: string;
  cards: Card[];
}
