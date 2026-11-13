import { describe, expect, it, vi } from "vitest";
import { createMapController } from "../src/ui/mapController.js";

describe("интерактивная карта", () => {
  it("масштабирует, двигает и ставит пользовательский маркер", () => {
    const onChange = vi.fn();
    const controller = createMapController({ onChange });
    controller.setZoom(10);
    controller.panBy(20, -5);
    controller.setWaypoint({ x: 100, y: 50, label: "Цель" });
    expect(controller.getState()).toMatchObject({
      zoom: 4,
      center: { x: 20, y: -5 },
      waypoint: { x: 100, y: 50, label: "Цель" },
    });
    expect(onChange).toHaveBeenCalledTimes(3);
    controller.clearWaypoint();
    expect(controller.getState().waypoint).toBeNull();
  });
});
