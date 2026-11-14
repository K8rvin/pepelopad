import { test, expect } from "@playwright/test";

async function installBalanceDriver(page) {
  await page.route("**/src/game.js*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "startAttract();\nrequestAnimationFrame(frame);";
    const driver = `      window.__balanceTest = {
        run: (seconds) => {
          const started = {
            shots: stats.shots,
            kills: stats.kills,
            looted: stats.looted,
            crafted: stats.crafted,
          };
          let deaths = 0,
            previousMain = Q.main;
          const milestones = [],
            supermarketBlock = OSM_PROJECTION.blockForSite("supermarket"),
            supermarket = planBlock(supermarketBlock.bx, supermarketBlock.by),
            supply = supermarket.containers[0];
          P.x = supply.x * 16 + 8;
          P.y = (supply.y + 2) * 16 + 8;
          for (let step = 0; step < seconds * 20; step++) {
            Z.length = 0;
            if (state === "dead") {
              deaths++;
              respawn();
            }
            if (step % 20 === 0) {
              const cx = Math.floor(P.x / 256),
                cy = Math.floor(P.y / 256);
              visChunks = [];
              for (let y = cy - 1; y <= cy + 1; y++)
                for (let x = cx - 1; x <= cx + 1; x++)
                  visChunks.push(getChunk(x, y));
            }
            if (P.hu < 45) {
              const food = inv.findIndex(
                (slot) => slot && ["eat", "drink"].includes(ITEMS[slot.id].use),
              );
              if (food >= 0) useItem(food);
            }
            if (P.hp < maxHp() * 0.55) {
              const medical = inv.findIndex(
                (slot) => slot && ITEMS[slot.id].use === "heal",
              );
              if (medical >= 0) useItem(medical);
            }
            if (P.mags.bow + countItem("arrow") < 8) {
              const recipe = RECIPES.find((entry) => entry.id === "arrow");
              if (!craftLock(recipe)) doCraft(recipe);
            }
            let target = null,
              best = 220 * 220;
            for (const container of CMAP.values()) {
              if (container.looted) continue;
              const distance = d2(
                P.x,
                P.y,
                container.x * 16 + 8,
                container.y * 16 + 8,
              );
              if (distance < best) {
                best = distance;
                target = container;
              }
            }
            let enemy = null,
              enemyDistance = Infinity;
            for (const zombie of Z) {
              const distance = d2(P.x, P.y, zombie.x, zombie.y);
              if (distance < enemyDistance) {
                enemyDistance = distance;
                enemy = zombie;
              }
            }
            let clearShot = Boolean(enemy);
            if (enemy)
              for (let i = 1; i < 16; i++) {
                const part = i / 16;
                if (
                  circleHit(
                    P.x + (enemy.x - P.x) * part,
                    P.y + (enemy.y - P.y) * part,
                    1,
                  )
                ) {
                  clearShot = false;
                  break;
                }
              }
            let dx = 0,
              dy = 0,
              doorApproach = false;
            const danger = enemy && enemyDistance < 75 * 75 && clearShot;
            if (danger) {
              searching = null;
              dx = P.x - enemy.x;
              dy = P.y - enemy.y;
            } else if (searching) {
              dx = 0;
              dy = 0;
            } else if (target) {
              if (best < 44 * 44) startSearch(target);
              else {
                const building = [...PLAN.values()]
                  .flatMap((plan) => plan.buildings)
                  .find(
                    (b) =>
                      target.x >= b.x &&
                      target.x < b.x + b.w &&
                      target.y >= b.y &&
                      target.y < b.y + b.h,
                  );
                doorApproach = Boolean(
                  building &&
                    !(
                      P.x / 16 >= building.x &&
                      P.x / 16 < building.x + building.w &&
                      P.y / 16 >= building.y &&
                      P.y / 16 < building.y + building.h
                    ),
                );
                if (doorApproach) {
                  dx =
                    (building.x + Math.floor(building.w / 2)) * 16 + 8 - P.x;
                  dy = (building.y + building.h - 1) * 16 + 8 - P.y;
                } else {
                  dx = target.x * 16 + 8 - P.x;
                  dy = target.y * 16 + 8 - P.y;
                }
              }
            } else {
              const angle = playT * 0.18;
              dx = Math.cos(angle) * 40;
              dy = Math.sin(angle) * 40;
            }
            if (!searching && !doorApproach && (dx || dy)) {
              const steering = steerAroundObstacles(P, dx, dy, (x, y) => {
                const hit = circleHit(x, y, P.r);
                return hit ? { kind: "tile" } : null;
              });
              dx = steering.mx;
              dy = steering.my;
            }
            keys.KeyD = dx > 3;
            keys.KeyA = dx < -3;
            keys.KeyS = dy > 3;
            keys.KeyW = dy < -3;
            mouse.down = Boolean(
              enemy && enemyDistance < 300 * 300 && clearShot,
            );
            if (enemy) {
              const aim = w2s(enemy.x, enemy.y);
              mouse.x = aim.x;
              mouse.y = aim.y;
            }
            update(0.05);
            if (Q.main !== previousMain) {
              milestones.push({ main: Q.main, minute: Math.round(playT / 60) });
              previousMain = Q.main;
            }
          }
          keys.KeyD = keys.KeyA = keys.KeyS = keys.KeyW = false;
          mouse.down = false;
          return {
            minutes: Math.round(playT / 60),
            deaths,
            milestones,
            level: P.lvl,
            main: Q.main,
            hp: Math.round(P.hp),
            hunger: Math.round(P.hu),
            shots: stats.shots - started.shots,
            kills: stats.kills - started.kills,
            looted: stats.looted - started.looted,
            crafted: stats.crafted - started.crafted,
            arrows: countItem("arrow") + P.mags.bow,
            wood: countItem("wood"),
            scrap: countItem("scrap"),
            cloth: countItem("cloth"),
            zombies: Z.length,
            position: [Math.round(P.x), Math.round(P.y)],
            nearest: [...CMAP.values()]
              .map((container) => ({
                x: container.x,
                y: container.y,
                looted: container.looted,
                distance: Math.round(
                  Math.hypot(container.x * 16 + 8 - P.x, container.y * 16 + 8 - P.y),
                ),
              }))
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 3),
          };
        },
      };
${marker}`;
    if (!source.includes(marker))
      throw new Error("Balance driver marker not found");
    await route.fulfill({ response, body: source.replace(marker, driver) });
  });
}

test("ускоренный playtest первых 20 минут", async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await installBalanceDriver(page);
  await page.goto("/");
  await page.locator("[data-d='easy']").click();
  await page.locator("#seedInp").fill("balance");
  await page.locator("#btnNew").click();
  await page.locator("#btnSkip").click();
  await page.waitForFunction(() => document.body.className === "play");
  const result = await page.evaluate(() => window.__balanceTest.run(1200));
  console.log("BALANCE_20_MIN", JSON.stringify(result));
  expect(result.minutes).toBeGreaterThanOrEqual(20);
  expect(result.looted).toBeGreaterThan(0);
  expect(result.main).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});
