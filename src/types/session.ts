export interface Card {
  id: string;
  name: string;
  count: number;
  imageId: string;
  cardBackId?: string | undefined; // Optional per-card back override
}

export interface Session {
  id: string;
  name: string;
  templateId: string;
  cards: Card[];
  cardBacksEnabled?: boolean;
  defaultCardBackId?: string;
}
