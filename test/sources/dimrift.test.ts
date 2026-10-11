import { describe, expect, test } from "bun:test";
import { type DimRiftCard, parseFilterExpression } from "@/sources/dimrift";

// Shaped like entries of https://luan.xyz/projects/dim-rift/data/cards.json
const CARDS: DimRiftCard[] = [
  {
    key: "hardened_peasant",
    kind: "core",
    name: "Hardened Peasant",
    type: { key: "creature", text: "Creature — Human" },
    faction: { key: "men", text: "Men" },
    fabled: false,
    subType: "human",
  },
  {
    key: "sword_of_theranor",
    kind: "core",
    name: "Sword of Theranor",
    type: { key: "artifact", text: "Fabled Artifact — Equipment" },
    faction: { key: "men", text: "Men" },
    fabled: true,
    subType: "equipment",
  },
  {
    key: "the_lone_wolf",
    kind: "core",
    name: "The Lone Wolf",
    type: { key: "creature", text: "Fabled Creature — Transformed Fey" },
    faction: { key: "fey", text: "Fey" },
    fabled: true,
    subType: "feyBeast",
  },
  {
    key: "_token-men-1",
    kind: "token",
    name: "Creature Token",
    type: { key: "creature", text: "Creature — Token" },
    faction: { key: "men", text: "Men" },
    fabled: false,
    subType: "token",
  },
  { key: "_symbols", kind: "reference", name: "Symbols" },
];

function filter(expr: string): string[] {
  return parseFilterExpression(expr, CARDS).map((card) => card.key);
}

describe("parseFilterExpression", () => {
  test("matches every core card for [all], skipping tokens and references", () => {
    expect(filter("all")).toEqual(["hardened_peasant", "sword_of_theranor", "the_lone_wolf"]);
  });

  test("includes tokens and references only when the filter names their kind", () => {
    expect(filter("men")).toEqual(["hardened_peasant", "sword_of_theranor"]);
    expect(filter("men token")).toEqual(["_token-men-1"]);
    expect(filter("reference")).toEqual(["_symbols"]);
  });

  test("matches fabled cards", () => {
    expect(filter("men fabled")).toEqual(["sword_of_theranor"]);
    expect(filter("all -fabled")).toEqual(["hardened_peasant"]);
  });
});
