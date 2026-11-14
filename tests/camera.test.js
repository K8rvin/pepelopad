import { describe, expect, it } from "vitest";
import {
  createCameraTransforms,
  lerpAngle,
  screenToWorld,
  shortestArc,
  speedZoomFactor,
  worldToScreen,
} from "../src/render/camera.js";

describe("camera math", () => {
  it("preserves the legacy translation and scale behavior by default", () => {
    const cam = { x: 100, y: 50 };
    expect(worldToScreen(120, 30, cam, 800, 400, 2)).toEqual({
      x: 440,
      y: 160,
    });
    expect(screenToWorld(440, 160, cam, 800, 400, 2)).toEqual({
      x: 120,
      y: 30,
    });
  });

  it("round-trips world and screen coordinates with rotation and zoom", () => {
    const cam = { x: 100, y: 50, zoom: 1.7, rotation: Math.PI / 3 };
    const screen = worldToScreen(135, 82, cam, 800, 600, 3);
    expect(screen).not.toEqual({ x: 505, y: 396 });
    const world = screenToWorld(screen.x, screen.y, cam, 800, 600, 3);
    expect(world.x).toBeCloseTo(135, 10);
    expect(world.y).toBeCloseTo(82, 10);
    expect(worldToScreen(100, 50, cam, 800, 600, 3)).toEqual({
      x: 400,
      y: 300,
    });
  });

  it("uses live viewport, scale, and camera values in bound transforms", () => {
    const cam = { x: 0, y: 0, zoom: 1, rotation: 0 };
    let width = 800;
    let scale = 3;
    const transforms = createCameraTransforms({
      cam,
      getViewport: () => ({ width, height: 600 }),
      getScale: () => scale,
    });
    expect(transforms.w2s(10, 0)).toEqual({ x: 430, y: 300 });
    cam.rotation = Math.PI / 2;
    cam.zoom = 2;
    width = 1000;
    scale = 2;
    expect(transforms.worldToScreen(10, 0)).toEqual({ x: 500, y: 340 });
    const world = transforms.screenToWorld(500, 340);
    expect(world.x).toBeCloseTo(10, 10);
    expect(world.y).toBeCloseTo(0, 10);
  });

  it("limits speed zoomout to thirty percent", () => {
    expect(speedZoomFactor(0, 100)).toBe(1);
    expect(speedZoomFactor(50, 100)).toBe(0.85);
    expect(speedZoomFactor(100, 100)).toBeCloseTo(0.7);
    expect(speedZoomFactor(500, 100)).toBeCloseTo(0.7);
    expect(speedZoomFactor(-100, 100)).toBeCloseTo(0.7);
    expect(speedZoomFactor(10, 0)).toBe(1);
  });

  it("interpolates angles through the shortest arc", () => {
    expect(shortestArc(0, (3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2);
    expect(shortestArc((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2);
    expect(lerpAngle(0, (3 * Math.PI) / 2, 0.5)).toBeCloseTo(-Math.PI / 4);
    const from = (350 * Math.PI) / 180;
    const to = (10 * Math.PI) / 180;
    expect(shortestArc(lerpAngle(from, to, 0.5), 0)).toBeCloseTo(0);
  });
});
