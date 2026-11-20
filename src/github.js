// Contribution data for the signed-in user, private repos included.
const { execFile } = require("node:child_process");
const { flattenWeeks, monthLabels, summary } = require("./stats.js");

const QUERY = `query {
  viewer {
    login name avatarUrl(size: 96)
    repositories(first: 4, orderBy: { field: PUSHED_AT, direction: DESC }, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
      nodes { nameWithOwner isPrivate pushedAt primaryLanguage { name color } }
    }
    contributionsCollection {
      totalCommitContributions totalPullRequestContributions
      totalIssueContributions totalPullRequestReviewContributions
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }
      commitContributionsByRepository(maxRepositories: 4) {
        repository { nameWithOwner isPrivate primaryLanguage { name color } }
        contributions { totalCount }
      }
    }
  }
}`;

/** @param {string[]} args @returns {Promise<string | null>} */
function gh(args) {
  return new Promise((resolve) => {
    execFile("gh", args, { windowsHide: true, timeout: 4000 }, (err, out) => {
      resolve(err ? null : out.trim() || null);
    });
  });
}

/** Token from the GitHub CLI: its active account, or `login` if given. Read only; never switches. */
const ghCliToken = (/** @type {string} */ login = "") =>
  gh(["auth", "token", "--hostname", "github.com", ...(login ? ["--user", login] : [])]);

/** Every github.com account the GitHub CLI holds, active one first. */
async function ghCliAccounts() {
  const out = await gh(["auth", "status", "--json", "hosts"]);
  try {
    /** @type {{ login: string, active: boolean, state: string }[]} */
    const list = JSON.parse(out ?? "").hosts["github.com"] ?? [];
    return list
      .filter((a) => a.state === "success")
      .sort((a, b) => Number(b.active) - Number(a.active))
      .map((a) => a.login);
  } catch {
    return [];
  }
}

/** @param {string} token */
async function fetchContributions(token) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "User-Agent": "commit-notch" },
    body: JSON.stringify({ query: QUERY }),
  });
  if (res.status === 401) throw Object.assign(new Error("GitHub rejected the token"), { auth: true });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  const v = json.data.viewer;
  const c = v.contributionsCollection;
  const days = flattenWeeks(c.contributionCalendar.weeks);
  return {
    login: v.login,
    name: v.name || v.login,
    avatar: v.avatarUrl,
    total: c.contributionCalendar.totalContributions,
    days,
    months: monthLabels(days),
    ...summary(days),
    kinds: {
      commits: c.totalCommitContributions,
      pullRequests: c.totalPullRequestContributions,
      issues: c.totalIssueContributions,
      reviews: c.totalPullRequestReviewContributions,
    },
    latest: v.repositories.nodes.map(
      /** @param {any} r */ (r) => ({
        name: r.nameWithOwner,
        private: r.isPrivate,
        language: r.primaryLanguage,
        pushedAt: r.pushedAt,
      }),
    ),
    repos: c.commitContributionsByRepository.map(
      /** @param {any} r */ (r) => ({
        name: r.repository.nameWithOwner,
        private: r.repository.isPrivate,
        language: r.repository.primaryLanguage,
        commits: r.contributions.totalCount,
      }),
    ),
  };
}

module.exports = { ghCliToken, ghCliAccounts, fetchContributions };
