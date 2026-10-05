import type { ReactNode } from "react";

export type KanbanItemBase = { id: string };

export type KanbanColumnData<T extends KanbanItemBase> = {
  id: string;
  title: string;
  items: T[];
};

/**
 * Callbacks may return `false` to cancel the local (optimistic) update,
 * e.g. when the user dismisses a confirmation or the API call fails.
 */
type MaybeCancel = boolean | void;

export type KanbanItemHelpers = {
  /** Calls `onDeleteItem` and removes the item from the board if not cancelled. */
  remove: () => void;
};

export type KanbanLabels = {
  addItem: string;
  addItemPlaceholder: string;
  addColumn: string;
  renameColumn: string;
  deleteColumn: string;
  syncing: string;
};

export type KanbanSync<T extends KanbanItemBase> = {
  /** Returns the full, fresh list of columns. */
  fetchColumns: () => Promise<KanbanColumnData<T>[]>;
  /** Refetch on a timer. Omit to disable polling. */
  pollingIntervalMs?: number;
  /**
   * Push-based sync (SSE, WebSocket...): call `notify` whenever the data changed
   * and the board refetches. Must return an unsubscribe function.
   */
  subscribe?: (notify: () => void) => () => void;
};

export type KanbanProps<T extends KanbanItemBase> = {
  columns: KanbanColumnData<T>[];
  renderItem: (item: T, helpers: KanbanItemHelpers) => ReactNode;
  /**
   * Hides items that return false (search/filters). Hidden items stay in the board
   * state, so drop indexes still count them and the saved order stays correct.
   */
  isItemVisible?: (item: T) => boolean;

  /** Fired after a drop that changed the item's column or position. */
  onMoveItem?: (itemId: string, toColumnId: string, toIndex: number) => MaybeCancel | Promise<MaybeCancel>;
  /** Enables the inline "add item" input. Return the created item to show it on the board. */
  onAddItem?: (columnId: string, title: string) => T | void | Promise<T | void>;
  onDeleteItem?: (itemId: string) => MaybeCancel | Promise<MaybeCancel>;

  /** Enables renaming a column by double-clicking its title. */
  onRenameColumn?: (columnId: string, title: string) => MaybeCancel | Promise<MaybeCancel>;
  /** Enables the column menu with "delete column". */
  onDeleteColumn?: (columnId: string) => MaybeCancel | Promise<MaybeCancel>;
  /** Enables the "add column" button. Return the created column to show it on the board. */
  onAddColumn?: () => KanbanColumnData<T> | void | Promise<KanbanColumnData<T> | void>;

  /** Optional sync with other clients. Deferred while an item is being dragged or moved. */
  sync?: KanbanSync<T>;

  labels?: Partial<KanbanLabels>;
  className?: string;
};
