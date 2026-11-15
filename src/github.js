// Contribution data for the signed-in user, private repos included.
const { execFile } = require("node:child_process");
const { flattenWeeks, monthLabels, summary } = require("./stats.js");

const QUERY = `query {
  viewer {
    login name avatarUrl(size: 96)
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

/** Token from the GitHub CLI if it's signed in, else null. */
function ghCliToken() {
  return new Promise((resolve) => {
    execFile("gh", ["auth", "token"], { windowsHide: true, timeout: 4000 }, (err, out) => {
      resolve(err ? null : out.trim() || null);
    });
  });
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

module.exports = { ghCliToken, fetchContributions };
