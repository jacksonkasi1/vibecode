// ** import core packages
import { Octokit } from "octokit";

interface GithubRepoRef {
  owner: string;
  repo: string;
  branch?: string;
}

function createGithubClient() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

export function parseGithubRepositoryUrl(repositoryUrl: string) {
  const normalized = repositoryUrl.replace(/\.git$/, "").trim();
  const match = normalized.match(/github\.com[:/]([^/]+)\/([^/]+)$/i);

  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
  } satisfies GithubRepoRef;
}

export async function getGithubTree(input: GithubRepoRef) {
  const client = createGithubClient();
  const branch = input.branch ?? "main";
  const branchResponse = await client.rest.repos.getBranch({
    owner: input.owner,
    repo: input.repo,
    branch,
  });

  const treeResponse = await client.rest.git.getTree({
    owner: input.owner,
    repo: input.repo,
    tree_sha: branchResponse.data.commit.sha,
    recursive: "true",
  });

  return {
    commitSha: branchResponse.data.commit.sha,
    tree: treeResponse.data.tree
      .filter((entry) => entry.type === "blob" && entry.path)
      .map((entry) => entry.path as string),
  };
}

export async function getGithubFileContent(
  input: GithubRepoRef & { path: string },
) {
  const client = createGithubClient();
  const response = await client.rest.repos.getContent({
    owner: input.owner,
    repo: input.repo,
    path: input.path,
    ref: input.branch,
  });

  if (Array.isArray(response.data) || response.data.type !== "file") {
    return null;
  }

  if (response.data.encoding !== "base64" || !response.data.content) {
    return null;
  }

  return Buffer.from(response.data.content, "base64").toString("utf8");
}

export async function getGithubLatestCommit(input: GithubRepoRef) {
  const client = createGithubClient();
  const branchResponse = await client.rest.repos.getBranch({
    owner: input.owner,
    repo: input.repo,
    branch: input.branch ?? "main",
  });

  return branchResponse.data.commit.sha;
}
