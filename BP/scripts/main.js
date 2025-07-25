import { dayLeveling } from "./DayLeveling";
import { world, EffectType, system } from "@minecraft/server";
import { showStatusUI } from "./ui/ShowStatusUI";
import { initializeFireFighterAxeLogic } from "./item/meleSystem";

// memanggil
initializeFireFighterAxeLogic();
dayLeveling();

// Initialize the status UI
world.beforeEvents.chatSend.subscribe((msg) => {
    if (msg.message.toLowerCase() === "!status") {
        msg.cancel = true;
        showStatusUI(msg.sender);
    }
});

// --- Zombie Kill Tracker ---
const ZOMBIE_ID = "za:zombie";
const PLAYER_KILL_PROP = "zombie_kill_count";

// Inisialisasi dynamic property untuk setiap pemain jika belum ada
function ensurePlayerKillProp(player) {
    if (player.getDynamicProperty(PLAYER_KILL_PROP) === undefined) {
        player.setDynamicProperty(PLAYER_KILL_PROP, 0);
    }
}

const PLAYER_STAMINA_PROP = "stamina";
const STAMINA_MAX = 100;
const STAMINA_MIN = 0;
const STAMINA_RECOVERY = 2; // per tick
const STAMINA_DRAIN = 1; // per tick jika lari

function ensurePlayerStaminaProp(player) {
    if (player.getDynamicProperty(PLAYER_STAMINA_PROP) === undefined) {
        player.setDynamicProperty(PLAYER_STAMINA_PROP, STAMINA_MAX);
    }
}

// Simpan posisi sebelumnya untuk deteksi movement
const lastPlayerPos = new Map();

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        ensurePlayerKillProp(player);
        ensurePlayerStaminaProp(player);
        // Ambil posisi sekarang
        const pos = player.location;
        const id = player.id ?? player.name;
        const last = lastPlayerPos.get(id);
        let moved = false;
        let speed = 0;
        if (last) {
            const dx = pos.x - last.x;
            const dy = pos.y - last.y;
            const dz = pos.z - last.z;
            speed = Math.sqrt(dx * dx + dy * dy + dz * dz);
            moved = speed > 0.01;
        }
        lastPlayerPos.set(id, { x: pos.x, y: pos.y, z: pos.z });

        // Deteksi lari (speed > 0.25), jalan (speed > 0.05), diam
        let stamina =
            player.getDynamicProperty(PLAYER_STAMINA_PROP) ?? STAMINA_MAX;
        if (speed > 0.25) {
            stamina -= STAMINA_DRAIN;
        } else {
            stamina += STAMINA_RECOVERY;
        }
        if (stamina > STAMINA_MAX) stamina = STAMINA_MAX;
        if (stamina < STAMINA_MIN) stamina = STAMINA_MIN;
        player.setDynamicProperty(PLAYER_STAMINA_PROP, stamina);

        // Tambahkan efek slowness jika stamina <= STAMINA_MIN, hilangkan jika >= 30
        if (stamina <= STAMINA_MIN) {
            player.addEffect("minecraft:slowness", 10000, {
                amplifier: 5,
                showParticles: false,
            }); // 10 detik, amplifier 2
        } else if (stamina >= 70) {
            player.removeEffect("minecraft:slowness");
        }
    }
}, 5); // tiap tick

// Tampilkan bar stamina di action bar setiap detik
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const stamina =
            player.getDynamicProperty(PLAYER_STAMINA_PROP) ?? STAMINA_MAX;
        // Buat bar stamina visual
        const barLength = 20;
        const filled = Math.round((stamina / STAMINA_MAX) * barLength);
        const empty = barLength - filled;
        const bar = `§a${"|".repeat(filled)}§7${"|".repeat(empty)}`;
        const text = `§lStamina: ${bar} §f${parseInt(stamina)}`;
        // Kirim ke action bar (subtitle) dengan fallback
        if (typeof player.runCommandAsync === "function") {
            player.runCommandAsync(
                `titleraw @s actionbar {\"rawtext\":[{\"text\":\"${text}\"}]}`
            );
        } else if (typeof player.runCommand === "function") {
            player.runCommand(
                `titleraw @s actionbar {\"rawtext\":[{\"text\":\"${text}\"}]}`
            );
        } else {
            world.sendMessage(text);
        }
    }
}, 5); // setiap detik





// Using another interval to remove the weakness effect faster, you can combine it with the other one if you dont mind the slight delay
system.runInterval(() => {
    for (let player of world.getAllPlayers()) {
        let item = player.getComponent("equippable").getEquipment("Mainhand")
        if (item === undefined) continue
        if (!(Object.keys(itemsConfig).includes(item.typeId))) continue

        player.addEffect("weakness", 1, {
            showParticles: false,
            amplifier: 255
        })
    }
})

// The config for each item, you can adjust these as u like
let itemsConfig = {
    "za:fire_fighter_axe": {
        cd: 0.5,
        dmg: 8
    }
}
let playersItemCD = {} // keep this empty, but dont remove this line

if (world.afterEvents && world.afterEvents.entityDie && world.afterEvents.entityHitEntity) {
    world.afterEvents.entityDie.subscribe((ev) => {
        if (
            ev.deadEntity.typeId === ZOMBIE_ID &&
            ev.damageSource?.damagingEntity?.typeId === "minecraft:player"
        ) {
            const player = ev.damageSource.damagingEntity;
            const current = player.getDynamicProperty(PLAYER_KILL_PROP) ?? 0;
            player.setDynamicProperty(PLAYER_KILL_PROP, current + 1);
        }
    });

    world.afterEvents.entityHitEntity.subscribe(event => {
        let entityHit = event.hitEntity
        let player = event.damagingEntity

        if (player.typeId != "minecraft:player") return

        let item = player.getComponent("equippable").getEquipment("Mainhand")
        if (!(Object.keys(itemsConfig).includes(item.typeId))) return

        player.playSound("note.pling", { pitch: 0.7, volume: 0.2 }) // Play sound when a hit is registered, u can remove this for the finsihed product

        let currentTime = Date.now()
        let skip = false
        if (!playersItemCD[player.nameTag]) { playersItemCD[player.nameTag] = currentTime; skip = true }

        if (!skip) {
            let timeDiff = (currentTime - playersItemCD[player.nameTag])/1000
            if (!(timeDiff >= itemsConfig[item.typeId].cd)) return
            playersItemCD[player.nameTag] = currentTime
        }

        system.runTimeout(() => {
            player.playSound("note.pling", {pitch: 1.5}) // This line also plays a sound when it deals dmg to the target, you can also remove this in the finale product
            if (!entityHit) return
            entityHit.applyDamage(8, { cause: "entityAttack", damagingEntity: player })
        }, itemsConfig[item.typeId].cd*20)
    })
}