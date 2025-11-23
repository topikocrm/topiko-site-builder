import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { log } from './utils';

interface TriggerPublishInput {
  siteId: string;
  siteConfig: any;
}

export async function triggerPublish(input: TriggerPublishInput) {
  log("Publishing site:", input.siteId);

  const configPath = path.join(process.cwd(), `data/sites/${input.siteId}/siteConfig.json`);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(input.siteConfig, null, 2));

  execSync(`git checkout main`);
  execSync(`git pull`);
  execSync(`git add .`);
  execSync(`git commit -m "Publish site ${input.siteId}" || true`);
  execSync(`git push`);

  log("Publish triggered!");
}