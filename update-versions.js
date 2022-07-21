const semanticRelease = require('semantic-release');
const editJsonFile = require("edit-json-file");

async function main() {
    try {
        const result = await semanticRelease(
            {plugins: ["@semantic-release/commit-analyzer"], dryRun: true},
            // Don't care about stdout and we'll log any errors below
            {stdout: {write: () => {}}, stderr: {write: () => {}}}
        );
        const nextVersion = result.nextRelease.version;

        let file = editJsonFile(`${__dirname}/package.json`);

        console.log(`Updating package.json version to ${nextVersion}...`);
        file.set("version", nextVersion);
        file.save();
    } catch (err) {
        console.error('Updating plugin version failed with %O', err);
    }
}

main();
