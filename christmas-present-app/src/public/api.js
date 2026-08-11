(function installAuthenticatedApiFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, options = {}) => {
    const requestUrl = typeof input === 'string' ? input : input.url;
    const url = new URL(requestUrl, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return originalFetch(input, options);
    }

    const headers = new Headers(options.headers || (typeof input !== 'string' ? input.headers : undefined));
    if (!headers.has('Authorization') && typeof supabaseClient !== 'undefined') {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
    }

    return originalFetch(input, { ...options, headers });
  };
})();
