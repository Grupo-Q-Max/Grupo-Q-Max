"use client";

import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragStartEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * Drag sensors for boards that also have to scroll on phones.
 *
 * - Mouse: drag after moving 5px, so clicks still open the card.
 * - Touch: drag only after a ~250ms press; a normal swipe keeps scrolling the
 *   column or the board (a pointer sensor would grab the card on any touch).
 * - Keyboard: space to pick up, arrows to move.
 */
export function useBoardSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

/** Short vibration when a long press picks up a card, so the user knows the drag started. */
export function vibrateOnTouchDrag({ activatorEvent }: DragStartEvent) {
  if (typeof TouchEvent !== "undefined" && activatorEvent instanceof TouchEvent) {
    navigator.vibrate?.(30);
  }
}
