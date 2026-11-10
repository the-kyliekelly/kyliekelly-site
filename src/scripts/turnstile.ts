// Cloudflare Turnstile ("are you human") helper shared by the sign-up forms.
// The Turnstile script is only loaded when someone first touches a form, so it never slows the page down for people who don't.
// The check is invisible unless Cloudflare needs the visitor to do something.
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loader: Promise<void> | null = null;

export function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!loader) {
    loader = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loader = null;
        reject(new Error('turnstile-failed-to-load'));
      };
      document.head.appendChild(script);
    });
  }
  return loader;
}

export function turnstileFor(container: HTMLElement, siteKey: string, theme: 'light' | 'dark' = 'light') {
  let widgetId: string | undefined;
  let token = '';
  let waiting: Array<(t: string) => void> = [];

  const start = () =>
    loadTurnstile()
      .then(() => {
        if (widgetId !== undefined || !window.turnstile) return;
        widgetId = window.turnstile.render(container, {
          sitekey: siteKey,
          theme,
          appearance: 'interaction-only',
          callback: (t: string) => {
            token = t;
            waiting.splice(0).forEach((done) => done(t));
          },
          'expired-callback': () => { token = ''; },
          'error-callback': () => { token = ''; },
        });
      })
      .catch(() => {});

  return {
    /** Start loading and setting up the check (call when the visitor first touches the form). */
    prepare: start,
    /** The check's token, waiting up to 10 seconds for it. Empty if it never arrived. */
    getToken(): Promise<string> {
      start();
      if (token) return Promise.resolve(token);
      return new Promise((resolve) => {
        waiting.push(resolve);
        setTimeout(() => resolve(token), 10000);
      });
    },
    /** Use after a failed attempt: a token can only be used once. */
    reset() {
      token = '';
      if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId);
    },
  };
}
