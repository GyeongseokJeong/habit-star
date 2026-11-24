import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const routing = JSON.parse(readFileSync(new URL("../docs/stakeholder-routing.json", import.meta.url), "utf8"));

export function selectStakeholders(route, modifiers = []) {
  const base = Object.hasOwn(routing.routes, route) ? routing.routes[route] : undefined;
  if (!base) throw new Error("Unknown route: " + route);
  const roles = new Set(base.roles), guards = new Set(base.guards);
  for (const modifier of modifiers) {
    const extra = Object.hasOwn(routing.modifiers, modifier) ? routing.modifiers[modifier] : undefined;
    if (!extra) throw new Error("Unknown modifier: " + modifier);
    extra.roles.forEach(role => roles.add(role));
    extra.guards.forEach(guard => guards.add(guard));
  }
  const roleSkills = routing.roles.filter(role => roles.has(role.id)).map(role => role.skill);
  return { route, modifiers: [...new Set(modifiers)], rounds: base.rounds,
    roles: routing.roles.filter(role => roles.has(role.id)).map(role => role.id),
    skills: [...(roleSkills.length ? ["stakeholder-panel"] : []), ...roleSkills, ...guards] };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const [route,...modifiers] = process.argv.slice(2);
    console.log(JSON.stringify(selectStakeholders(route, modifiers), null, 2));
  } catch (e) {
    console.error(e.message);
    console.error("Routes: " + Object.keys(routing.routes).join(", "));
    console.error("Modifiers: " + Object.keys(routing.modifiers).join(", "));
    process.exitCode = 1;
  }
}
