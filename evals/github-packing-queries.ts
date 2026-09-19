export interface PackingQuery {
  id: string;
  need: string;
  expectedId: string;
}

/** Capability needs against the GitHub REST OpenAPI snapshot. */
export const GITHUB_PACKING_QUERIES: PackingQuery[] = [
  {
    id: "pr-files",
    need: "I need an endpoint that lists the files changed by a pull request",
    expectedId: "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
  },
  {
    id: "pr-create",
    need: "I need an endpoint that opens a new pull request against a repository",
    expectedId: "POST /repos/{owner}/{repo}/pulls",
  },
  {
    id: "pr-merge",
    need: "I need an endpoint that merges an open pull request",
    expectedId: "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
  },
  {
    id: "pr-commits",
    need: "I need an endpoint that lists the commits that belong to a pull request",
    expectedId: "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
  },
  {
    id: "pr-list",
    need: "I need an endpoint that lists pull requests in a repository",
    expectedId: "GET /repos/{owner}/{repo}/pulls",
  },
  {
    id: "pr-reviews",
    need: "I need an endpoint that lists reviews on a pull request",
    expectedId: "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
  },
  {
    id: "pr-request-reviewers",
    need: "I need an endpoint that requests reviewers on a pull request",
    expectedId: "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
  },
  {
    id: "issue-create",
    need: "I need an endpoint that creates a new issue in a repository",
    expectedId: "POST /repos/{owner}/{repo}/issues",
  },
  {
    id: "issue-list",
    need: "I need an endpoint that lists issues in a repository",
    expectedId: "GET /repos/{owner}/{repo}/issues",
  },
  {
    id: "issue-comment",
    need: "I need an endpoint that posts a comment on an issue",
    expectedId: "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
  },
  {
    id: "actions-runs",
    need: "I need an endpoint that lists GitHub Actions workflow runs for a repository",
    expectedId: "GET /repos/{owner}/{repo}/actions/runs",
  },
  {
    id: "actions-logs",
    need: "I need an endpoint that downloads the logs for a workflow run",
    expectedId: "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs",
  },
  {
    id: "actions-cancel",
    need: "I need an endpoint that cancels a running GitHub Actions workflow run",
    expectedId: "POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel",
  },
  {
    id: "actions-artifacts",
    need: "I need an endpoint that lists workflow artifacts for a repository",
    expectedId: "GET /repos/{owner}/{repo}/actions/artifacts",
  },
  {
    id: "gist-create",
    need: "I need an endpoint that creates a new gist",
    expectedId: "POST /gists",
  },
  {
    id: "search-repos",
    need: "I need an endpoint that searches GitHub repositories by a query string",
    expectedId: "GET /search/repositories",
  },
  {
    id: "search-code",
    need: "I need an endpoint that searches file contents across GitHub",
    expectedId: "GET /search/code",
  },
  {
    id: "search-users",
    need: "I need an endpoint that searches for GitHub users",
    expectedId: "GET /search/users",
  },
  {
    id: "user-me",
    need: "I need an endpoint that returns the currently authenticated GitHub user",
    expectedId: "GET /user",
  },
  {
    id: "user-emails",
    need: "I need an endpoint that lists email addresses for the authenticated user",
    expectedId: "GET /user/emails",
  },
  {
    id: "star-repo",
    need: "I need an endpoint that stars a repository for the authenticated user",
    expectedId: "PUT /user/starred/{owner}/{repo}",
  },
  {
    id: "collaborators-list",
    need: "I need an endpoint that lists collaborators on a repository",
    expectedId: "GET /repos/{owner}/{repo}/collaborators",
  },
  {
    id: "collaborators-add",
    need: "I need an endpoint that invites a user as a collaborator on a repository",
    expectedId: "PUT /repos/{owner}/{repo}/collaborators/{username}",
  },
  {
    id: "repo-create",
    need: "I need an endpoint that creates a new repository for the authenticated user",
    expectedId: "POST /user/repos",
  },
  {
    id: "repo-fork",
    need: "I need an endpoint that forks a repository",
    expectedId: "POST /repos/{owner}/{repo}/forks",
  },
  {
    id: "releases-list",
    need: "I need an endpoint that lists releases for a repository",
    expectedId: "GET /repos/{owner}/{repo}/releases",
  },
  {
    id: "releases-create",
    need: "I need an endpoint that creates a GitHub release",
    expectedId: "POST /repos/{owner}/{repo}/releases",
  },
  {
    id: "git-tree",
    need: "I need an endpoint that fetches a git tree by SHA",
    expectedId: "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
  },
  {
    id: "git-blob-create",
    need: "I need an endpoint that creates a git blob in a repository",
    expectedId: "POST /repos/{owner}/{repo}/git/blobs",
  },
  {
    id: "branches-list",
    need: "I need an endpoint that lists branches in a repository",
    expectedId: "GET /repos/{owner}/{repo}/branches",
  },
  {
    id: "teams-list",
    need: "I need an endpoint that lists teams in an organization",
    expectedId: "GET /orgs/{org}/teams",
  },
  {
    id: "teams-create",
    need: "I need an endpoint that creates a team in an organization",
    expectedId: "POST /orgs/{org}/teams",
  },
  {
    id: "notifications-list",
    need: "I need an endpoint that lists notifications for the authenticated user",
    expectedId: "GET /notifications",
  },
  {
    id: "notifications-mark-read",
    need: "I need an endpoint that marks all notifications as read",
    expectedId: "PUT /notifications",
  },
  {
    id: "org-repos",
    need: "I need an endpoint that lists repositories in an organization",
    expectedId: "GET /orgs/{org}/repos",
  },
  {
    id: "repo-languages",
    need: "I need an endpoint that reports which programming languages a repository uses",
    expectedId: "GET /repos/{owner}/{repo}/languages",
  },
  {
    id: "repo-commits",
    need: "I need an endpoint that lists commits on a repository",
    expectedId: "GET /repos/{owner}/{repo}/commits",
  },
  {
    id: "compare-commits",
    need: "I need an endpoint that compares two commits or branches and returns the diff",
    expectedId: "GET /repos/{owner}/{repo}/compare/{basehead}",
  },
  {
    id: "labels-list",
    need: "I need an endpoint that lists labels in a repository",
    expectedId: "GET /repos/{owner}/{repo}/labels",
  },
  {
    id: "labels-create",
    need: "I need an endpoint that creates a label in a repository",
    expectedId: "POST /repos/{owner}/{repo}/labels",
  },
  {
    id: "hooks-list",
    need: "I need an endpoint that lists webhooks on a repository",
    expectedId: "GET /repos/{owner}/{repo}/hooks",
  },
  {
    id: "hooks-create",
    need: "I need an endpoint that creates a webhook on a repository",
    expectedId: "POST /repos/{owner}/{repo}/hooks",
  },
  {
    id: "file-get",
    need: "I need an endpoint that reads a file from a repository by path",
    expectedId: "GET /repos/{owner}/{repo}/contents/{path}",
  },
  {
    id: "file-put",
    need: "I need an endpoint that creates or updates a file in a repository by path",
    expectedId: "PUT /repos/{owner}/{repo}/contents/{path}",
  },
  {
    id: "packages-org",
    need: "I need an endpoint that lists packages owned by an organization",
    expectedId: "GET /orgs/{org}/packages",
  },
  {
    id: "sbom",
    need: "I need an endpoint that exports a software bill of materials for a repository",
    expectedId: "GET /repos/{owner}/{repo}/dependency-graph/sbom",
  },
  {
    id: "advisories-repo",
    need: "I need an endpoint that lists security advisories for a repository",
    expectedId: "GET /repos/{owner}/{repo}/security-advisories",
  },
  {
    id: "gists-user",
    need: "I need an endpoint that lists public gists for a given username",
    expectedId: "GET /users/{username}/gists",
  },
  {
    id: "check-run-get",
    need: "I need an endpoint that fetches a check run by id",
    expectedId: "GET /repos/{owner}/{repo}/check-runs/{check_run_id}",
  },
  {
    id: "codespaces-user",
    need: "I need an endpoint that lists codespaces for the authenticated user",
    expectedId: "GET /user/codespaces",
  },
];
