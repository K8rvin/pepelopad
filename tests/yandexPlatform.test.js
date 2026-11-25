import { afterEach, describe, expect, it } from "vitest";
import {
  chooseNewestSave,
  createYandexPlatform,
} from "../src/iso/platform/yandex.js";
import { createGameplayReporter } from "../src/iso/systems/pause.js";

afterEach(() => {
  delete globalThis.YaGames;
});

function mockSdk() {
  const calls = { ready: 0, start: 0, stop: 0, setData: [], scores: [] };
  const player = {
    data: null,
    async setData(data) {
      calls.setData.push(data);
      this.data = data;
    },
    async getData() {
      return this.data;
    },
  };
  const leaderboards = {
    async setLeaderboardScore(id, score) {
      calls.scores.push([id, score]);
    },
  };
  return {
    calls,
    player,
    ysdk: {
      features: {
        LoadingAPI: { ready: () => calls.ready++ },
        GameplayAPI: {
          start: () => calls.start++,
          stop: () => calls.stop++,
        },
      },
      async getPlayer() {
        return player;
      },
      async getLeaderboards() {
        return leaderboards;
      },
    },
  };
}

describe("Yandex SDK adapter", () => {
  it("без SDK работает graceful no-op", async () => {
    const platform = await createYandexPlatform();
    expect(platform.available).toBe(false);
    expect(await platform.saveCloud({ v: 6 })).toBe(false);
    expect(await platform.loadCloud()).toBeNull();
    expect(await platform.submitScores({ day: 1, kills: 2 })).toBe(false);
    expect(() => {
      platform.loadingReady();
      platform.gameplayStart();
      platform.gameplayStop();
    }).not.toThrow();
  });

  it("ready/gameplay, gzip-сейв и лидерборды вызываются через SDK", async () => {
    const mock = mockSdk();
    globalThis.YaGames = { init: async () => mock.ysdk };
    const platform = await createYandexPlatform();
    expect(platform.available).toBe(true);
    expect(platform.cloudAvailable).toBe(true);
    expect(platform.leaderboardsAvailable).toBe(true);
    platform.loadingReady();
    platform.gameplayStart();
    platform.gameplayStop();
    expect(mock.calls).toMatchObject({ ready: 1, start: 1, stop: 1 });

    const data = {
      v: 6,
      savedAt: 100,
      zombies: Array.from({ length: 4450 }, (_, i) => ({
        x: i,
        y: i,
        hp: 70,
        dead: false,
        type: "walker",
        level: 0,
        questGroup: null,
        siege: false,
      })),
    };
    expect(await platform.saveCloud(data)).toBe(true);
    expect(mock.calls.setData[0].format).toBe("gzip-v1");
    expect(mock.calls.setData[0].payload.length).toBeLessThan(190000);
    expect(await platform.loadCloud()).toEqual(data);
    expect(await platform.submitScores({ day: 3.9, kills: 12.8 })).toBe(true);
    expect(mock.calls.scores).toEqual([
      ["survival_days", 3],
      ["zombie_kills", 12],
    ]);
  });

  it("выбирает более новый сейв, при равенстве оставляет локальный", () => {
    const local = { savedAt: 100, side: "local" };
    const olderCloud = { savedAt: 50, side: "cloud" };
    const newerCloud = { savedAt: 150, side: "cloud" };
    expect(chooseNewestSave(local, olderCloud)).toBe(local);
    expect(chooseNewestSave(local, newerCloud)).toBe(newerCloud);
    expect(chooseNewestSave(null, newerCloud)).toBe(newerCloud);
    expect(chooseNewestSave(local, null)).toBe(local);
  });

  it("ошибки инициализации и облака не ломают локальную игру", async () => {
    globalThis.YaGames = {
      init: async () => Promise.reject(new Error("offline")),
    };
    expect((await createYandexPlatform()).available).toBe(false);

    const mock = mockSdk();
    mock.player.getData = async () => Promise.reject(new Error("cloud error"));
    mock.player.setData = async () => Promise.reject(new Error("cloud error"));
    globalThis.YaGames = { init: async () => mock.ysdk };
    const platform = await createYandexPlatform();
    expect(await platform.loadCloud()).toBeNull();
    expect(await platform.saveCloud({ v: 6 })).toBe(false);
  });
});

describe("GameplayAPI reporter", () => {
  it("сообщает только об изменении паузы", () => {
    const events = [];
    const report = createGameplayReporter({
      onStart: () => events.push("start"),
      onStop: () => events.push("stop"),
    });
    report(false);
    report(false);
    report(true);
    report(true);
    report(false);
    expect(events).toEqual(["start", "stop", "start"]);
  });
});
