export function createBranchName(siteId: string) {
  return `preview-${siteId}`;
}

export function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function log(...args: any[]) {
  console.log("[Topiko Publish]", ...args);
}