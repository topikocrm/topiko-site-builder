import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createBranchName, log } from './utils';

interface TriggerPreviewInput {
  siteId: string;
  siteConfig: any;
}

export async function triggerPreview(input: TriggerPreviewInput) {
  const branch = createBranchName(input.siteId);

  log("Preparing preview for", input.siteId);

  const configPath = path.join(process.cwd(), `data/sites/${input.siteId}/siteConfig.json`);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(input.siteConfig, null, 2));

  execSync(`git checkout -B ${branch}`);
  execSync(`git add .`);
  execSync(`git commit -m "Preview update for ${input.siteId}" || true`);
  execSync(`git push -u origin ${branch}`);

  log("Preview triggered!");
}