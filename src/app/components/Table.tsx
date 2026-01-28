import { useState } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T, index: number) => React.ReactNode;
  width?: string;
  main?: boolean; // If true, this column expands to fill available space
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export function Table<T>({ data, columns, keyExtractor, onReorder }: TableProps<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const canReorder = onReorder && data.length > 1;

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index || !onReorder) return;
    onReorder(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <table>
      <thead>
        <tr>
          {onReorder && <th style={{ width: "32px" }}></th>}
          {columns.map((col) => (
            <th
              key={col.key}
              style={{ width: col.main ? "100%" : col.width }}
              className={col.main ? undefined : "nowrap"}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr
            key={keyExtractor(item)}
            onDragOver={(e) => handleDragOver(e, index)}
            style={{ opacity: dragIndex === index ? 0.5 : 1 }}
          >
            {onReorder && (
              <td
                draggable={canReorder}
                onDragStart={canReorder ? () => handleDragStart(index) : undefined}
                onDragEnd={canReorder ? handleDragEnd : undefined}
                className={canReorder ? "drag-handle" : "drag-handle disabled"}
                title={canReorder ? "Drag to reorder" : undefined}
              >
                ⠿
              </td>
            )}
            {columns.map((col) => (
              <td key={col.key} className={col.main ? undefined : "nowrap"}>
                {col.render(item, index)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
