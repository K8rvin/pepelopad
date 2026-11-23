import { ALL_QUESTS } from "../data/quests.js";
import { CLUES } from "../data/storyObjects.js";
import {
  claimPendingRewards,
  claimQuestReward,
  currentStage,
  failQuest,
  goalDone,
  mainQuest,
  qEvent,
  questStatus,
  questTarget,
  refreshQuestAvailability,
  trackedQuest,
  trackQuest,
} from "./quests.js";
import { applyStoryEffects } from "./story.js";
import {
  advanceDialogue,
  closeDialogue,
  createDialogue,
  dialogueChoices,
  openDialogue,
  selectDialogue,
} from "./dialogue.js";
import { objectAvailable, performInteraction } from "./interactions.js";
import {
  followingSurvivor,
  syncSurvivors,
  updateSurvivors,
} from "./survivors.js";
import { syncNpcs } from "./npcs.js";
import { spawnZombie } from "./actors.js";
import { createSiege, retrySiege, startSiege, updateSiege } from "./siege.js";
import { storySite, storySiteContains } from "../world/storyLocations.js";
import { countItem } from "./inventory.js";

export function createCampaignRuntime(state, callbacks = {}) {
  const {
    city,
    player,
    inv,
    quests,
    story,
    camps,
    survivors,
    interactions,
    npcs,
    survival,
    combat,
  } = state;
  const siege = state.siege || createSiege();
  const dialogue = createDialogue();
  let visitTimer = 0;
  let syncTimer = 0;
  let vanCargoWarned = false;

  function context() {
    return {
      city,
      player,
      inv,
      quests,
      story,
      camps,
      survivors,
      interactions,
      npcs,
      survival,
      combat,
      siege,
      questDefs: ALL_QUESTS,
    };
  }

  function sync() {
    refreshQuestAvailability(quests, ALL_QUESTS);
    syncSurvivors(survivors, context());
    for (const object of interactions.objects)
      object.visible = objectAvailable(object, context());
    syncNpcs(npcs, city, camps, survivors, story, quests, survival);
    const motel = storySite(city, "motel");
    if (motel) motel.powerOff = !story.generatorOn;
  }

  function event(type, data = {}) {
    const result = qEvent(quests, ALL_QUESTS, type, data);
    handleResult(result);
    return result;
  }

  function handleResult(result) {
    if (!result) return;
    for (const advanced of result.advanced || []) {
      if (advanced.quest.kind === "main")
        callbacks.notify?.(
          advanced.quest.stages[advanced.stage]?.desc || advanced.quest.desc,
        );
    }
    for (const def of result.completed || []) {
      const reward = claimQuestReward(quests, def, inv);
      callbacks.banner?.(def);
      callbacks.sound?.("quest");
      if (reward.pending.length)
        callbacks.notify?.(
          "Награда не поместилась. Она сохранена в журнале и будет выдана при наличии места.",
          true,
        );
      executeEffects(def.effects);
    }
    const claimed = claimPendingRewards(quests, inv);
    for (const [id, n] of claimed)
      callbacks.notify?.(`Отложенная награда: ${id} ×${n}`);
    sync();
    ensureEncounters();
  }

  function executeEffects(effects) {
    const output = applyStoryEffects(story, effects, context());
    for (const result of output.questResults) handleResult(result);
    executeCommands(output.commands);
    sync();
    return output;
  }

  function executeCommands(commands) {
    for (const command of commands) {
      if (command.type === "clue")
        callbacks.notify?.(
          `Улика: ${CLUES[command.id]?.title || command.id}`,
          true,
        );
      else if (command.type === "accepted") {
        callbacks.notify?.(
          `Новое задание: ${ALL_QUESTS.find((q) => q.id === command.id)?.name || command.id}`,
          true,
        );
        if (command.id === "s_last_ride" && story.flags.workshop_van_ready)
          event("repair", { target: "workshop_van" });
      } else if (command.type === "items")
        callbacks.notify?.(`Получено: ${command.id} ×${command.n}`);
      else if (command.type === "missing")
        callbacks.notify?.("Не хватает необходимых предметов.");
      else if (command.type === "deliveryMissing")
        callbacks.notify?.(
          "Не хватает предметов для сдачи. Ничего не потеряно.",
        );
      else if (command.type === "full")
        callbacks.notify?.("Рюкзак полон. Содержимое осталось на месте.");
      else if (command.type === "trunkFull")
        callbacks.notify?.("В багажнике недостаточно места.");
      else if (command.type === "home")
        callbacks.notify?.(
          "Ваш номер открыт: личный ящик, кровать и точка возрождения.",
          true,
        );
      else if (command.type === "follow") startFollowing(command.id);
      else if (command.type === "spawnGroup") spawnGroup(command.id);
      else if (command.type === "openCamp") callbacks.openCamp?.(command.id);
      else if (command.type === "homeStorage") callbacks.openHome?.();
      else if (command.type === "sleep") callbacks.sleep?.();
      else if (command.type === "startSiege") beginSiege();
      else if (command.type === "noise") callbacks.noise?.(command.radius);
      else if (command.type === "message") callbacks.notify?.(command.text);
      else if (command.type === "rebuildWorld") callbacks.rebuild?.();
      else if (command.type === "vehicleLoaded")
        callbacks.notify?.(
          "Груз загружен в багажник. Не выгружай его до прибытия.",
        );
      else if (command.type === "generator")
        callbacks.notify?.(
          command.on ? "Генератор включён." : "Генератор заглушён.",
        );
      else if (command.type === "ending") applyEnding(command.id);
    }
  }

  function startFollowing(id) {
    const target = survivors.find((s) => s.id === id);
    if (!target || ["dead", "rescued"].includes(target.state)) return;
    const current = followingSurvivor(survivors);
    if (current && current !== target) current.state = "waiting";
    target.state = "following";
    target.hidden = false;
    callbacks.notify?.(`${target.name}: E — следовать или ждать.`);
  }

  function spawnGroup(id) {
    const flag = `spawned_${id}`;
    if (story.flags[flag]) return;
    story.flags[flag] = true;
    const siteId =
      id === "gas_rescue"
        ? "gas"
        : id === "night_guest_attack"
          ? "motel"
          : "workshop";
    const site = storySite(city, siteId);
    if (!site) return;
    const counts = {
      gas_rescue: 3,
      workshop_route: 4,
      mark_attack: 5,
      night_guest_attack: 4,
    };
    const count = counts[id] || 4;
    for (let i = 0; i < count; i++) {
      const x = site.x + site.w / 2 + (i - count / 2) * 2;
      const y = site.y + site.h + 8 + (i % 2) * 2;
      const zombie = spawnZombie(
        city,
        x,
        y,
        i > 1 && id !== "gas_rescue" ? "runner" : "walker",
      );
      if (!zombie) continue;
      zombie.questGroup = id;
      zombie.tx = player.x;
      zombie.ty = player.y;
      zombie.alertT = 10;
    }
    callbacks.sound?.("growl");
  }

  function ensureEncounters() {
    if (
      mainQuest(quests, ALL_QUESTS)?.id === "m12" &&
      (quests.stages.m12 || 0) === 2
    )
      spawnGroup("workshop_route");
    if (
      mainQuest(quests, ALL_QUESTS)?.id === "m13" &&
      (quests.stages.m13 || 0) === 1 &&
      story.flags.mark_met
    )
      spawnGroup("mark_attack");
    if (
      questStatus(quests, "s_night_guest") === "active" &&
      (quests.stages.s_night_guest || 0) === 1 &&
      story.flags.night_gate_opened
    )
      spawnGroup("night_guest_attack");
  }

  function talk(npcId) {
    const conversation = selectDialogue(npcId, context());
    if (!conversation) return false;
    openDialogue(dialogue, conversation);
    callbacks.dialogue?.(dialogue);
    event("talk", { target: npcId });
    return true;
  }

  function choose(choice) {
    if (!dialogue.conversation || !choice) return;
    const id = dialogue.conversation.id;
    story.seen[id] = true;
    closeDialogue(dialogue);
    callbacks.dialogue?.(dialogue);
    executeEffects(choice.effects);
  }

  function advance() {
    if (!dialogue.conversation) return false;
    if (advanceDialogue(dialogue)) {
      callbacks.dialogue?.(dialogue);
      return true;
    }
    if (dialogueChoices(dialogue, context()).length) return true;
    closeDialogue(dialogue);
    callbacks.dialogue?.(dialogue);
    return false;
  }

  function close(force = false) {
    if (!dialogue.conversation) return true;
    if (dialogue.conversation.critical && !force) {
      callbacks.notify?.("Нужно закончить разговор и выбрать ответ.");
      return false;
    }
    closeDialogue(dialogue);
    callbacks.dialogue?.(dialogue);
    return true;
  }

  function interact(object) {
    const output = performInteraction(interactions, object, context());
    for (const result of output.questResults) handleResult(result);
    executeCommands(output.commands);
    for (const item of output.events) event(item.type, item.data);
    sync();
    return output;
  }

  function resolveTarget(descriptor) {
    if (!descriptor) return null;
    if (descriptor.object) {
      const object = interactions.objects.find(
        (o) => o.id === descriptor.object,
      );
      return object
        ? {
            x: object.x - 0.5,
            y: object.y - 0.5,
            w: 1,
            h: 1,
            floors: 1,
            poi: object.name,
          }
        : null;
    }
    if (descriptor.npc) {
      const npc = npcs.find((n) => n.id === descriptor.npc && !n.hidden);
      const survivor = survivors.find(
        (s) => s.id === descriptor.npc && !s.hidden,
      );
      const target = npc || survivor;
      return target
        ? {
            x: target.x - 0.5,
            y: target.y - 0.5,
            w: 1,
            h: 1,
            floors: 1,
            poi: target.name,
          }
        : null;
    }
    if (descriptor.site) return storySite(city, descriptor.site);
    return null;
  }

  function target(side = false) {
    const def = side
      ? trackedQuest(quests, ALL_QUESTS)
      : mainQuest(quests, ALL_QUESTS);
    return resolveTarget(questTarget(quests, ALL_QUESTS, def?.id));
  }

  function update(dt, inCar) {
    syncTimer -= dt;
    if (syncTimer <= 0) {
      syncTimer = 0.2;
      sync();
    }
    const events = updateSurvivors(survivors, city, player, camps, dt, inCar);
    for (const item of events) {
      if (item.type === "rescue") {
        callbacks.notify?.(
          `${item.survivor.name} в безопасности: ${item.camp.id}.`,
          true,
        );
        callbacks.sound?.("quest");
        event("rescue", { id: item.survivor.id, camp: item.camp.id });
      } else if (item.type === "leftBehind")
        callbacks.notify?.(
          `${item.survivor.name} ждёт. Вернись за ним пешком.`,
          true,
        );
    }
    visitTimer -= dt;
    if (visitTimer <= 0) {
      visitTimer = 0.4;
      for (const site of ["gas", "motel", "school", "workshop"])
        if (storySiteContains(city, site, player.x, player.y))
          event("visit", { target: site });
    }
    updateVehicleDelivery(inCar);
    const siegeEvent = updateSiege(siege, city, dt, story, camps);
    if (siegeEvent?.type === "defend")
      event("defend", { target: siegeEvent.target });
    else if (siegeEvent?.type === "wave")
      callbacks.notify?.(`Волна ${siegeEvent.wave}/3!`, true);
    else if (siegeEvent?.type === "respite")
      callbacks.notify?.("Передышка: 20 секунд на лечение и подготовку.", true);
    else if (siegeEvent?.type === "gateBroken")
      callbacks.notify?.("Ворота проломлены! Держи двор!", true);
  }

  function updateVehicleDelivery(inCar) {
    if (
      !inCar ||
      inCar.storyId !== "story_van" ||
      questStatus(quests, "s_last_ride") !== "active" ||
      (quests.stages.s_last_ride || 0) !== 2
    )
      return;
    const camp = camps.find(
      (c) =>
        ["motel", "school"].includes(c.id) &&
        Math.hypot(inCar.x - c.x, inCar.y - c.y) < 12,
    );
    if (!camp) return;
    const trunk = inCar.trunk;
    if (!trunk || countItem(trunk, "can") < 4 || countItem(trunk, "meds") < 2) {
      if (!vanCargoWarned)
        callbacks.notify?.(
          "В багажнике нет всего груза: нужно 4 еды и 2 бинта.",
          true,
        );
      vanCargoWarned = true;
      return;
    }
    const result = event("deliverVehicle", {
      vehicle: "story_van",
      camp: camp.id,
    });
    if (result.completed.some((q) => q.id === "s_last_ride")) {
      for (const slot of trunk.slots) {
        if (!slot) continue;
        camp.stock.push({
          id: slot.id,
          n: slot.n,
          cost: {},
          minTrust: 0,
          free: true,
        });
      }
      trunk.slots.fill(null);
      camp.trust += 15;
      callbacks.notify?.(
        `Груз доставлен: ${camp.id}. Люди помогут в обороне.`,
        true,
      );
    }
  }

  function beginSiege() {
    if (startSiege(siege, city, story, camps))
      callbacks.notify?.("Осада началась. Первая волна идёт к воротам!", true);
  }

  function retrySiegeWave() {
    return retrySiege(siege, city, story, camps);
  }

  function onSurvivorDead(survivor) {
    story.flags[`dead_${survivor.id}`] = true;
    callbacks.notify?.(
      `${survivor.name} погиб. Его история останется в журнале.`,
      true,
    );
    const side =
      survivor.id === "tolya"
        ? "s_tolya"
        : survivor.id === "night_guest"
          ? "s_night_guest"
          : null;
    if (side) failQuest(quests, side);
  }

  function newDay() {
    if (!story.generatorOn || !story.flags.generator_repaired) return;
    story.generatorFuel = Math.max(0, story.generatorFuel - 1);
    if (!story.generatorFuel) {
      story.generatorOn = false;
      callbacks.notify?.("Генератор мотеля заглушён: топливо закончилось.");
    }
  }

  function applyEnding(id) {
    const motel = camps.find((c) => c.id === "motel");
    const school = camps.find((c) => c.id === "school");
    if (id === "open") {
      motel.trust += 20;
      school.trust += 20;
      motel.rescued ||= [];
      for (const resident of ["school_delegate", "school_family"])
        if (!motel.rescued.includes(resident)) motel.rescued.push(resident);
      story.flags.gates_open = true;
    } else if (id === "closed") {
      motel.trust += 10;
      school.trust = Math.max(0, school.trust - 10);
      story.flags.gates_closed = true;
    } else {
      const united =
        school.trust >= 30 && motel.trust >= 20 && story.clues.length >= 8;
      story.flags.council_united = united;
      story.flags.council_split = !united;
      if (united) {
        motel.trust += 12;
        school.trust += 12;
      }
    }
    callbacks.ending?.(id, {
      markRelation: story.markRelation,
      clues: [...story.clues],
    });
    sync();
  }

  sync();
  ensureEncounters();
  if (siege.active) retrySiegeWave();

  return {
    dialogue,
    siege,
    context,
    event,
    talk,
    choose,
    advance,
    close,
    interact,
    target,
    track: (id) => trackQuest(quests, ALL_QUESTS, id),
    update,
    sync,
    retrySiegeWave,
    onSurvivorDead,
    newDay,
    executeEffects,
  };
}
