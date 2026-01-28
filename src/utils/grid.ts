import type { Dimension } from "@/types/dimension";
import type { Slot } from "@/types/template";

export interface GridConfig {
  cols: number;
  rows: number;
  gap: number;
  cardSize: Dimension;
  pageSize: Dimension;
}

export function generateGrid({ cols, rows, gap, cardSize, pageSize }: GridConfig): Slot[] {
  const totalWidth = cols * cardSize.width + (cols - 1) * gap;
  const totalHeight = rows * cardSize.height + (rows - 1) * gap;
  const startX = (pageSize.width - totalWidth) / 2;
  const startY = (pageSize.height - totalHeight) / 2;

  const slots: Slot[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({
        x: startX + col * (cardSize.width + gap),
        y: startY + row * (cardSize.height + gap),
      });
    }
  }
  return slots;
}
