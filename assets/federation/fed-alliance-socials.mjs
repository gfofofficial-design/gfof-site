export const PROJECT_SOCIAL_LIMIT = 20;

const platforms = new Map([
  ['x.com', 'X'], ['twitter.com', 'X'],
  ['t.me', 'Telegram'], ['telegram.me', 'Telegram'],
  ['discord.com', 'Discord'], ['discord.gg', 'Discord'],
  ['youtube.com', 'YouTube'], ['youtu.be', 'YouTube'],
  ['instagram.com', 'Instagram'], ['tiktok.com', 'TikTok'],
  ['linkedin.com', 'LinkedIn'], ['facebook.com', 'Facebook'],
  ['reddit.com', 'Reddit'], ['bsky.app', 'Bluesky'],
  ['threads.net', 'Threads'], ['threads.com', 'Threads'],
  ['farcaster.xyz', 'Farcaster'], ['warpcast.com', 'Farcaster'],
  ['github.com', 'GitHub'], ['medium.com', 'Medium'],
  ['twitch.tv', 'Twitch'], ['signal.me', 'Signal'],
  ['linktr.ee', 'Linktree'],
]);

export function publicProjectUrl(value) {
  if (typeof value !== 'string' || value.length > 500 || !value.startsWith('https://') ||
    /[\s\p{Cc}\p{Cf}<>\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    // Treat service labels as hostname hints. Unknown services show their own domain.
    const domain = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z][a-z0-9-]*$/;
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      domain.test(url.hostname) && url.href.length <= 500 ? url : null;
  } catch {
    return null;
  }
}

export function projectSocialLinks(values = []) {
  if (!Array.isArray(values) || values.length > PROJECT_SOCIAL_LIMIT) {
    return { error: 'Enter up to ' + PROJECT_SOCIAL_LIMIT + ' public social links.' };
  }
  const links = new Map();
  for (const [index, value] of values.entries()) {
    const url = publicProjectUrl(value);
    if (!url) return { error: 'Use a public HTTPS link on line ' + (index + 1) + '.' };
    const host = url.hostname.replace(/^(?:www|m)\./, '');
    links.set(url.href, { label: platforms.get(host) ?? host, host: url.hostname, href: url.href });
  }
  return { links: [...links.values()] };
}
