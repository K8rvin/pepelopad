import { test, expect } from "@playwright/test";

async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.goto("/?new=1&nb=9&intro=0");
  await page.waitForFunction(() => window.__city?.campaign);
  return errors;
}

test("постоянный NPC сближается, бьёт своим оружием и отвлекает зомби", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const c = window.__city;
    for (const z of c.city.zombies) z.dead = true;
    const n = c.npcs.find((n) => n.id === "vera");
    Object.assign(n, { hidden: false, tx: n.x, ty: n.y, snapNext: false });
    const z = c.spawn(n.x + 1, n.y, "walker");
    z.hp = 30;
    z.attackCd = 0;
    window.__defNpc = n;
    window.__defZ = z;
    c.teleport(n.x + 4, n.y + 0.5);
    c.cam.x = n.x;
    c.cam.y = n.y;
    document.querySelector("#levelup").style.display = "none";
  });
  await page.waitForFunction(
    () => window.__defNpc.swingT > 0.18 && window.__defZ.hp < 30,
    undefined,
    { timeout: 7000 },
  );
  expect(
    await page.evaluate(() => ({
      weapon: window.__defNpc.swingWeapon,
      hp: window.__defZ.hp,
    })),
  ).toEqual({ weapon: "hammer", hp: 20 });
  await page.screenshot({ path: ".cache/npc_defense.png" });
  await page.waitForFunction(
    () => window.__defZ.attackTarget === "npc:vera",
    undefined,
    { timeout: 5000 },
  );
  await page.waitForFunction(() => window.__defZ.dead, undefined, {
    timeout: 7000,
  });
  expect(
    await page.evaluate(() => ({
      hidden: window.__defNpc.hidden,
      hp: window.__defNpc.hp,
    })),
  ).toEqual({ hidden: false, hp: undefined });
  expect(errors).toEqual([]);
});

test("спутник обороняется ножом и сохраняет смертность и следование", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const c = window.__city;
    c.quests.states = { m02: "active" };
    c.quests.stages = { m02: 0 };
    c.quests.done = ["m00", "m01"];
    for (const z of c.city.zombies) z.dead = true;
    const s = c.survivors.find((s) => s.id === "nina");
    Object.assign(s, { state: "following", hidden: false, hp: 80 });
    c.campaign.sync();
    const z = c.spawn(s.x + 1, s.y, "walker");
    z.hp = 28;
    z.attackCd = 0;
    window.__defNpc = s;
    window.__defZ = z;
    c.teleport(s.x + 4, s.y + 0.5);
  });
  await page.waitForFunction(
    () => window.__defNpc.swingT > 0 && window.__defZ.hp < 28,
    undefined,
    { timeout: 7000 },
  );
  expect(
    await page.evaluate(() => ({
      weapon: window.__defNpc.swingWeapon,
      state: window.__defNpc.state,
      hp: window.__defNpc.hp,
    })),
  ).toEqual({ weapon: "knife", state: "following", hp: 80 });
  await page.waitForFunction(
    () => window.__defZ.attackTarget === "nina",
    undefined,
    { timeout: 5000 },
  );
  await page.waitForFunction(() => window.__defNpc.hp < 80, undefined, {
    timeout: 5000,
  });
  expect(await page.evaluate(() => window.__defNpc.state)).toBe("following");
  expect(errors).toEqual([]);
});
