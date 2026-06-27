import 'server-only';

// Imports a candidate's public GitHub profile into grounding text via the public
// GitHub REST API -- proof of work, languages, and the bio in their own words.
// Public, ToS-safe endpoints only; we never scrape. Unauthenticated calls are
// rate-limited (60/hr/IP) which is plenty for occasional candidate imports.

const MAX_REPOS = 10;
const MAX_OUTPUT_CHARS = 50000;

interface GitHubUser {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  public_repos: number;
  followers: number;
}

interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  html_url: string;
}

/** Extracts a GitHub username from a raw handle or any github.com profile URL. */
export function parseGitHubUsername(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const fromUrl = raw.match(/github\.com\/([A-Za-z0-9-]+)/i);
  const handle = (fromUrl ? fromUrl[1] : raw).replace(/^@/, '');
  return /^[A-Za-z0-9-]{1,39}$/.test(handle) ? handle : null;
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'RoleBoost' },
    // Profile data changes rarely; let the platform cache briefly.
    next: { revalidate: 3600 },
  });
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (res.status === 403) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error('FETCH_FAILED');
  return res.json() as Promise<T>;
}

export async function fetchGitHubProfile(
  usernameOrUrl: string,
): Promise<{ label: string; text: string; url: string }> {
  const username = parseGitHubUsername(usernameOrUrl);
  if (!username) throw new Error('INVALID_INPUT');

  const user = await gh<GitHubUser>(`/users/${username}`);
  const repos = await gh<GitHubRepo[]>(`/users/${username}/repos?sort=stars&direction=desc&per_page=30`);

  const sections: string[] = [];

  const head = [
    user.name ? `Name: ${user.name}` : '',
    `GitHub: @${user.login}`,
    user.bio ? `Bio: ${user.bio}` : '',
    user.company ? `Company: ${user.company}` : '',
    user.location ? `Location: ${user.location}` : '',
    user.blog ? `Site: ${user.blog}` : '',
    `Public repos: ${user.public_repos} · Followers: ${user.followers}`,
  ].filter(Boolean);
  sections.push(`## GitHub profile\n${head.join('\n')}`);

  const top = repos
    .filter((r) => !r.fork && !r.archived)
    .slice(0, MAX_REPOS)
    .map((r) => {
      const meta = [r.language, r.stargazers_count ? `★${r.stargazers_count}` : ''].filter(Boolean).join(' · ');
      return `- ${r.name}${meta ? ` (${meta})` : ''}${r.description ? `: ${r.description}` : ''}`;
    });
  if (top.length) sections.push(`## Notable repositories\n${top.join('\n')}`);

  // Aggregate the languages across the top repos as a quick skills signal.
  const languages = Array.from(
    new Set(repos.filter((r) => !r.fork && r.language).map((r) => r.language as string)),
  ).slice(0, 15);
  if (languages.length) sections.push(`## Languages\n${languages.join(', ')}`);

  return {
    label: `GitHub (@${user.login})`,
    text: sections.join('\n\n').slice(0, MAX_OUTPUT_CHARS).trim(),
    url: `https://github.com/${user.login}`,
  };
}
