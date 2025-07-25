import { world } from "@minecraft/server";

export function dialogDay10(player) {
    const day = world.getDay();
    if (day == 10) {
        // Menggunakan rawtext untuk support translasi
        player.runCommandAsync(
            `titleraw @s title {"rawtext":[
                {"text":"§e["},
                {"selector":"@s"},
                {"text":"§e]: "},
                {"translate":"dialog.day10.title"}
            ]}`
        );
    }
}