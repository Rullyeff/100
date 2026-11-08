import { checkedAt } from "@/seratus/lib/checked-at";
import { expect, it } from "vitest";
import { createGame, AVATAR_COUNT } from "./engine";

const cfg = (avatar?: number) => Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, isBot: i > 0, avatar: i === 0 ? avatar : i }));

it("offers 18 avatars", () => expect(AVATAR_COUNT).toBe(18));
it("keeps a chosen profession avatar (index 17)", () => expect(checkedAt(createGame(cfg(17), 1).players, 0).avatar).toBe(17));
it("falls back to the seat default for an out-of-range avatar", () => expect(checkedAt(createGame(cfg(18), 1).players, 0).avatar).toBe(0));
