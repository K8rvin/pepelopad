const MAX_CLOUD_CHARS = 190000;

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function packSave(data) {
  const text = JSON.stringify(data);
  if (typeof CompressionStream === "undefined")
    return text.length <= MAX_CLOUD_CHARS ? data : null;
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const packed = await new Response(stream).arrayBuffer();
  const payload = bytesToBase64(new Uint8Array(packed));
  return payload.length <= MAX_CLOUD_CHARS
    ? { format: "gzip-v1", payload }
    : null;
}

export async function unpackSave(data) {
  if (!data || Object.keys(data).length === 0) return null;
  if (data.format !== "gzip-v1") return data;
  const stream = new Blob([base64ToBytes(data.payload)])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

export function chooseNewestSave(local, cloud) {
  if (!local) return cloud || null;
  if (!cloud) return local;
  return (cloud.savedAt || 0) > (local.savedAt || 0) ? cloud : local;
}

function unavailable() {
  return {
    available: false,
    cloudAvailable: false,
    leaderboardsAvailable: false,
    loadingReady() {},
    gameplayStart() {},
    gameplayStop() {},
    async saveCloud() {
      return false;
    },
    async loadCloud() {
      return null;
    },
    async clearCloud() {
      return false;
    },
    async submitScores() {
      return false;
    },
  };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("SDK timeout")), ms),
    ),
  ]);
}

function isYandexHost() {
  const host = globalThis.location?.hostname || "";
  return /(^|\.)yandex\./.test(host) || host === "yandex.games";
}

async function ensureSdkScript(timeoutMs) {
  if (typeof globalThis.YaGames?.init === "function") return true;
  if (!isYandexHost()) return false;
  const script = document.createElement("script");
  script.src = "https://yandex.ru/games/sdk/v2";
  const loaded = new Promise((resolve, reject) => {
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("SDK load failed"));
    setTimeout(() => reject(new Error("SDK load timeout")), timeoutMs);
  });
  document.head.append(script);
  await loaded;
  return typeof globalThis.YaGames?.init === "function";
}

function ignoreSync(fn) {
  try {
    fn();
  } catch {}
}

async function ignoreError(fn) {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}

export async function createYandexPlatform({ timeoutMs = 3000 } = {}) {
  let ysdk;
  try {
    if (!(await ensureSdkScript(timeoutMs))) return unavailable();
    ysdk = await withTimeout(globalThis.YaGames.init(), timeoutMs);
  } catch {
    return unavailable();
  }
  const [player, leaderboards] = await Promise.all([
    typeof ysdk.getPlayer === "function"
      ? ysdk.getPlayer({ scopes: false }).catch(() => null)
      : null,
    typeof ysdk.getLeaderboards === "function"
      ? ysdk.getLeaderboards().catch(() => null)
      : null,
  ]);
  return {
    available: true,
    cloudAvailable: !!player,
    leaderboardsAvailable: !!leaderboards,
    loadingReady() {
      ignoreSync(() => ysdk.features?.LoadingAPI?.ready?.());
    },
    gameplayStart() {
      ignoreSync(() => ysdk.features?.GameplayAPI?.start?.());
    },
    gameplayStop() {
      ignoreSync(() => ysdk.features?.GameplayAPI?.stop?.());
    },
    async saveCloud(data) {
      if (!player) return false;
      const packed = await packSave(data);
      if (!packed) return false;
      return ignoreError(() => player.setData(packed));
    },
    async loadCloud() {
      if (!player) return null;
      try {
        return await unpackSave(await player.getData());
      } catch {
        return null;
      }
    },
    async clearCloud() {
      if (!player) return false;
      return ignoreError(() => player.setData({}));
    },
    async submitScores({ day, kills }) {
      if (!leaderboards) return false;
      const results = await Promise.allSettled([
        leaderboards.setLeaderboardScore(
          "survival_days",
          Math.max(0, Math.floor(day)),
        ),
        leaderboards.setLeaderboardScore(
          "zombie_kills",
          Math.max(0, Math.floor(kills)),
        ),
      ]);
      return results.every((r) => r.status === "fulfilled");
    },
  };
}
