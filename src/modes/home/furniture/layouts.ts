// layouts.ts — Canonical default room layouts. Used as initial fallback
// in RoomLayoutProvider and by the "Reset" button in Furnish mode.

import type { RoomLayout } from "../../../state/RoomLayoutContext";

const ROOM_W = 1100;
const ROOM_H = 580;
const FLOOR_Y = 440;

export const ROOM_DIMENSIONS = { width: ROOM_W, height: ROOM_H, floorY: FLOOR_Y };

const onFloor = (h: number, y: number = FLOOR_Y): number => y - h;

export function makeStudyLayout(): RoomLayout {
  return {
    items: [
      { id: "w-window",   kindId: "window",    x: 40,  y: 70 },
      { id: "w-picture",  kindId: "picture",   x: 220, y: 80 },
      { id: "w-calendar", kindId: "calendar",  x: 420, y: 90 },
      { id: "w-clock",    kindId: "clock",     x: 540, y: 95 },
      { id: "w-sconce",   kindId: "sconce",    x: 700, y: 130 },
      { id: "f-shelf",    kindId: "bookshelf", x: 130, y: onFloor(230) },
      { id: "f-teacart",  kindId: "teacart",   x: 260, y: onFloor(96) },
      { id: "f-desk",     kindId: "desk",      x: 360, y: onFloor(110) },
      { id: "f-rug",      kindId: "rug",       x: 360, y: onFloor(24, FLOOR_Y + 18) },
      { id: "f-chair",    kindId: "chair",     x: 580, y: onFloor(140) },
      { id: "f-plant",    kindId: "plant",     x: 700, y: onFloor(116) },
      { id: "f-stack",    kindId: "stack",     x: 800, y: onFloor(50) },
      { id: "f-bed",      kindId: "petbed",    x: 770, y: onFloor(32) },
      { id: "f-fire",     kindId: "fireplace", x: 920, y: onFloor(180) },
    ],
  };
}

export function makeMinimalStudyLayout(): RoomLayout {
  return {
    items: [
      { id: "w-window", kindId: "window",    x: 100, y: 90 },
      { id: "w-clock",  kindId: "clock",     x: 540, y: 110 },
      { id: "f-desk",   kindId: "desk",      x: 380, y: onFloor(110) },
      { id: "f-chair",  kindId: "chair",     x: 600, y: onFloor(140) },
      { id: "f-plant",  kindId: "plant",     x: 740, y: onFloor(116) },
      { id: "f-bed",    kindId: "petbed",    x: 850, y: onFloor(32) },
      { id: "f-lamp",   kindId: "floorlamp", x: 260, y: onFloor(230) },
    ],
  };
}

export function makeLibraryLayout(): RoomLayout {
  return {
    items: [
      { id: "f-s1",      kindId: "bookshelf", x: 40,  y: onFloor(230) },
      { id: "f-s2",      kindId: "bookshelf", x: 170, y: onFloor(230) },
      { id: "f-s3",      kindId: "bookshelf", x: 300, y: onFloor(230) },
      { id: "f-s4",      kindId: "bookshelf", x: 900, y: onFloor(230) },
      { id: "w-clock",   kindId: "clock",     x: 470, y: 90 },
      { id: "w-picture", kindId: "picture",   x: 560, y: 80 },
      { id: "w-sconce",  kindId: "sconce",    x: 720, y: 110 },
      { id: "f-chair",   kindId: "chair",     x: 540, y: onFloor(140) },
      { id: "f-lamp",    kindId: "floorlamp", x: 470, y: onFloor(230) },
      { id: "f-globe",   kindId: "globe",     x: 800, y: onFloor(96) },
      { id: "f-stack",   kindId: "stack",     x: 700, y: onFloor(50) },
      { id: "f-rug",     kindId: "rug",       x: 480, y: onFloor(24, FLOOR_Y + 18) },
      { id: "f-bed",     kindId: "petbed",    x: 660, y: onFloor(32) },
    ],
  };
}

export function makeGarretLayout(): RoomLayout {
  return {
    items: [
      { id: "w-window", kindId: "window",    x: 440, y: 130 },
      { id: "f-desk",   kindId: "desk",      x: 360, y: onFloor(110) },
      { id: "f-chair",  kindId: "chair",     x: 600, y: onFloor(140) },
      { id: "f-lamp",   kindId: "floorlamp", x: 290, y: onFloor(230) },
      { id: "f-stack",  kindId: "stack",     x: 720, y: onFloor(50) },
      { id: "f-bed",    kindId: "petbed",    x: 800, y: onFloor(32) },
    ],
  };
}
