import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const skillRoot = join(root, ".agents/skills");
const names = [
  "design-guardian",
  "feature-builder",
  "data-guardian",
  "quality-gate",
  "accessibility-auditor",
  "release-guardian",
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
  "Skill directory set differs from expected six",
);
const workflow = file("docs/DEVELOPMENT_RULES.md");
for (const scenario of [
  "반복 요일 설정 UI",
  "Supabase 데이터 모델 변경",
  "GitHub CI 실패 수정",
])
  check(workflow.includes(scenario), `Missing scenario: ${scenario}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${names.length} skills, constitution, document references and scenarios.`,
  );
}
