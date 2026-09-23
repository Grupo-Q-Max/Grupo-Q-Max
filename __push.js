const { execSync } = require("child_process");

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

run("git add -A");
run('git commit -m "fix: resolve production image upload and serving via API streaming"');
run("git push origin main");
