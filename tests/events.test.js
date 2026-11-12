import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "../src/core/events.js";

describe("шина событий", () => {
  it("доставляет событие подписчикам по имени", () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.on("loot", listener);
    bus.emit("loot", { id: "wood", n: 2 });
    expect(listener).toHaveBeenCalledWith({ id: "wood", n: 2 }, "loot");
  });

  it("поддерживает универсального подписчика", () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.on("*", listener);
    bus.emit("drive", { m: 20 });
    expect(listener).toHaveBeenCalledWith({ m: 20 }, "drive");
  });

  it("отписывается и не вызывает удалённого слушателя", () => {
    const bus = createEventBus();
    const listener = vi.fn();
    const unsubscribe = bus.on("loot", listener);
    unsubscribe();
    bus.emit("loot", {});
    expect(listener).not.toHaveBeenCalled();
  });

  it("не смешивает подписчиков разных шин", () => {
    const first = createEventBus();
    const second = createEventBus();
    const listener = vi.fn();
    first.on("loot", listener);
    second.emit("loot", {});
    expect(listener).not.toHaveBeenCalled();
  });
});
