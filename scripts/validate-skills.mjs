import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { selectStakeholders } from "./select-stakeholders.mjs";

const root = resolve(import.meta.dirname, "..");
const skillRoot = join(root, ".agents/skills");
const names = [
  "design-guardian",
  "feature-builder",
  "data-guardian",
  "quality-gate",
  "accessibility-auditor",
  "release-guardian",
  "stakeholder-panel",
  "product-planner",
  "ui-specialist",
  "ux-specialist",
  "business-strategist",
  "growth-marketer",
  "user-perspective",
  "software-architect",
  "clean-code-specialist",
  "senior-fullstack-developer",
  "server-operations-specialist",
];
const sections = [
  "호출 조건 및 제외 조건",
  "참조 문서",
  "실행 절차",
  "금지 사항",
  "완료 기준",
  "실패 시 대응",
  "최종 결과 보고 형식",
];
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};
const file = (relative) => {
  const full = resolve(root, relative);
  check(full.startsWith(`${root}/`), `Invalid path: ${relative}`);
  check(existsSync(full), `Missing file: ${relative}`);
  return existsSync(full) ? readFileSync(full, "utf8") : "";
};

const constitution = file("AGENTS.md");
const requiredDocs = [
  "PRODUCT_PHILOSOPHY.md",
  "DESIGN_SYSTEM.md",
  "ARCHITECTURE.md",
  "DEVELOPMENT_RULES.md",
  "STAKEHOLDER_HARNESS.md",
];
for (const doc of requiredDocs) {
  file(`docs/${doc}`);
  check(
    constitution.includes(`docs/${doc}`),
    `AGENTS.md does not link docs/${doc}`,
  );
}
for (const name of names) {
  const path = `.agents/skills/${name}/SKILL.md`;
  const content = file(path);
  check(constitution.includes(`(${path})`), `AGENTS.md does not link ${path}`);
  check(constitution.includes(name), `AGENTS.md does not select ${name}`);
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(content)?.[1];
  check(Boolean(frontmatter), `${path}: YAML frontmatter missing`);
  const metadata = Object.fromEntries(
    [...(frontmatter ?? "").matchAll(/^([\w-]+):\s*(.+)$/gm)].map(
      ([, key, value]) => [key, value.trim()],
    ),
  );
  check(metadata.name === name, `${path}: name must match directory`);
  check(
    Boolean(metadata.description) && metadata.description.length <= 1024,
    `${path}: description missing or too long`,
  );
  for (const section of sections)
    check(
      content.includes(`## ${section}\n`),
      `${path}: missing section ${section}`,
    );
  const references = [...content.matchAll(/`(docs\/[^`]+\.md)`/g)].map(
    (match) => match[1],
  );
  check(references.length > 0, `${path}: missing document references`);
  for (const reference of references) file(reference);
}
const actual = existsSync(skillRoot)
  ? readdirSync(skillRoot, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
  : [];
check(
  actual.length === names.length &&
    actual.every((name) => names.includes(name)),
  "Skill directory set differs from expected registry",
);
const workflow = file("docs/DEVELOPMENT_RULES.md");
for (const scenario of [
  "반복 요일 설정 UI",
  "Supabase 데이터 모델 변경",
  "GitHub CI 실패 수정",
])
  check(workflow.includes(scenario), `Missing scenario: ${scenario}`);

// Stakeholder routes and role criteria are a checked contract, not an agent runner.
const routing = JSON.parse(file("docs/stakeholder-routing.json"));
const roleIds = routing.roles.map(role => role.id);
const guardIds = names.slice(0, 6);
check(routing.version === 2, "Unexpected stakeholder routing version");
check(roleIds.length === 10 && new Set(roleIds).size === 10, "Expected ten unique role IDs");
check(new Set(routing.roles.map(role=>role.skill)).size === 10, "Role skills must be unique");
for (const role of routing.roles) {
  check(names.includes(role.skill) && !guardIds.includes(role.skill) && role.skill !== "stakeholder-panel", "Invalid role skill: " + role.skill);
  const content = file(".agents/skills/" + role.skill + "/SKILL.md");
  check(role.criteria.length > 0 && new Set(role.criteria.map(c=>c.id)).size === role.criteria.length, "Duplicate/missing role criteria: " + role.id);
  check(role.criteria.every(c=>Number.isInteger(c.weight)&&c.weight>0) && role.criteria.reduce((sum,c)=>sum+c.weight,0)===100, "Invalid role weights: " + role.id);
  for (const c of role.criteria) check(content.split("\n").some(line=>line.startsWith("| "+c.id+" |")&&line.endsWith("| "+c.weight+" |")), "Role rubric mismatch: "+role.id+"/"+c.id);
}
for (const [key,route] of [...Object.entries(routing.routes),...Object.entries(routing.modifiers)]) {
  check(route.roles.every(id=>roleIds.includes(id)), "Unknown route role: "+key);
  check(route.guards.every(id=>guardIds.includes(id)), "Unknown guard: "+key);
  check(new Set(route.roles).size===route.roles.length && new Set(route.guards).size===route.guards.length,"Duplicate route entries: "+key);
}
check(routing.reviewPolicy.maxRounds===3 && routing.reviewPolicy.standardMinRounds===2 && routing.reviewPolicy.lightweightMinRounds===1,"Invalid review policy bounds");
check(JSON.stringify(routing.reviewPolicy.phases)===JSON.stringify(["independent-review","challenge","rebuttal","revise","reassess"]),"Critical review phases missing");
check(JSON.stringify(routing.reviewPolicy.blockingSeverities)===JSON.stringify(["P0","P1"]),"Blocking severities changed");
for(const [key,route] of Object.entries(routing.routes)) check(Number.isInteger(route.minRounds)&&Number.isInteger(route.rounds)&&route.minRounds>=1&&route.rounds>=route.minRounds&&route.rounds<=3,"Invalid rounds: "+key);
for(const [key,modifier] of Object.entries(routing.modifiers)) check(modifier.minRounds===undefined||[1,2,3].includes(modifier.minRounds),"Invalid modifier rounds: "+key);
for (const [route, modifiers, expectedRoles, expectedGuards, minRounds, rounds] of [
 ["ui-concept",["ui"],["product","ui","ux","user"],["design-guardian","accessibility-auditor"],2,3],
 ["new-feature",["ui","data","implementation"],["product","ui","ux","user","architect","clean-code","fullstack"],["feature-builder","quality-gate","design-guardian","accessibility-auditor","data-guardian"],2,3],
 ["feature-discovery",[],["product","ui","ux","business","marketing","user"],[],2,3],
 ["monetization",["ui","acquisition"],["product","ui","ux","business","marketing","user"],["feature-builder","quality-gate","design-guardian","accessibility-auditor"],2,3],
 ["marketing",[],["product","business","marketing","user"],[],2,3],
 ["user-facing-bug",["ui"],["ui","ux","user","fullstack"],["feature-builder","quality-gate","design-guardian","accessibility-auditor"],1,3],
 ["technical",[],[],["quality-gate"],1,1],
 ["technical",["data","implementation"],["architect","clean-code","fullstack"],["quality-gate","data-guardian","feature-builder"],2,3],
 ["release",["ui","data"],["product","ui","ux","business","marketing","user","architect","fullstack","operations"],["release-guardian","quality-gate","design-guardian","accessibility-auditor","data-guardian"],2,3],
 ["harness",[],["product","architect","clean-code"],["quality-gate"],2,3],
 ["architecture",["data","implementation"],["architect","clean-code","fullstack"],["feature-builder","quality-gate","data-guardian"],2,3],
 ["code-review",["architecture"],["architect","clean-code","fullstack"],["quality-gate"],2,3],
 ["operations",["data"],["architect","fullstack","operations"],["quality-gate","data-guardian"],2,3],
 ["technical",["operations","release"],["operations"],["quality-gate","release-guardian"],2,3],
]) {
 const selected=selectStakeholders(route,modifiers);
 const expectedSkills=[...(expectedRoles.length?["stakeholder-panel"]:[]), ...routing.roles.filter(role=>expectedRoles.includes(role.id)).map(role=>role.skill),...expectedGuards];
 check(JSON.stringify(selected.roles)===JSON.stringify(expectedRoles),"Role scenario mismatch: "+route);
 check(selected.minRounds===minRounds&&selected.rounds===rounds,"Round scenario mismatch: "+route);
 check(JSON.stringify(selected.reviewPhases)===JSON.stringify(routing.reviewPolicy.phases),"Review phase mismatch: "+route);
 check(selected.skills.length===expectedSkills.length&&expectedSkills.every(id=>selected.skills.includes(id)),"Skill scenario mismatch: "+route);
}
for(const args of [["__unknown__",[]],["technical",["__unknown__"]],["constructor",[]]]){
  let rejected=false;try{selectStakeholders(...args)}catch{rejected=true;}
  check(rejected,"Invalid selection accepted: "+args[0]);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${names.length} skills, constitution, document references and scenarios.`,
  );
}
