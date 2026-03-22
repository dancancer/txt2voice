const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const scriptPath = path.resolve(__dirname, "..", "deploy-remote-web.sh");
const repoRoot = path.resolve(__dirname, "..", "..");
const localBranch = spawnSync("git", ["branch", "--show-current"], {
  encoding: "utf8",
  cwd: repoRoot,
}).stdout.trim();

test("dry run should print deploy clone bootstrap and pull commands", () => {
  const result = spawnSync(
    "bash",
    [
      scriptPath,
      "--dry-run",
      "--host",
      "192.168.88.9",
    ],
    {
      encoding: "utf8",
      cwd: repoRoot,
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /remote_dir=\/root\/deploy\/txt2voice-web/);
  assert.match(result.stdout, /git clone .*txt2voice\.git .*\/root\/deploy\/txt2voice-web/);
  assert.match(result.stdout, /git fetch origin/);
  assert.match(result.stdout, new RegExp(`git pull --ff-only origin ${localBranch}`));
  assert.match(result.stdout, /ln -sfn \/root\/code\/txt2voice\/\.env .*\/root\/deploy\/txt2voice-web\/\.env/);
  assert.match(result.stdout, /docker compose -p txt2voice up -d --no-deps web/);
  assert.match(result.stdout, /for attempt in \$\(seq 1 30\)/);
  assert.match(result.stdout, /sleep 2/);
  assert.match(result.stdout, /curl -fsS http:\/\/192\.168\.88\.9:3001\/api\/health/);
});

test("dry run should respect custom remote dir", () => {
  const result = spawnSync(
    "bash",
    [
      scriptPath,
      "--dry-run",
      "--remote-dir",
      "/srv/txt2voice-deploy",
    ],
    {
      encoding: "utf8",
      cwd: repoRoot,
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /remote_dir=\/srv\/txt2voice-deploy/);
  assert.match(result.stdout, new RegExp(`git pull --ff-only origin ${localBranch}`));
});

test("dry run should default to current local branch", () => {
  const result = spawnSync("bash", [scriptPath, "--dry-run"], {
    encoding: "utf8",
    cwd: repoRoot,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`local_branch=${localBranch}`));
  assert.match(result.stdout, new RegExp(`git pull --ff-only origin ${localBranch}`));
  assert.match(result.stdout, /current_remote_branch="\$\(git branch --show-current \|\| true\)"/);
  assert.match(result.stdout, /Remote deploy branch mismatch/);
});

test("script should reject deploying a branch different from current local branch", () => {
  const mismatchBranch = localBranch === "main" ? "codex/test-branch" : "main";
  const result = spawnSync(
    "bash",
    [scriptPath, "--dry-run", "--branch", mismatchBranch],
    {
      encoding: "utf8",
      cwd: repoRoot,
    }
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    new RegExp(
      `Deploy branch mismatch: local branch is ${localBranch}, requested branch is ${mismatchBranch}`
    )
  );
});
