/* ============================================================
   2vStudio — search.js
   Instant client-side search across editors and portfolio.
   ============================================================ */

const SearchEngine = {
  /**
   * Returns { editors: [...], portfolio: [...] } matching the query.
   */
  async run(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return { editors: [], portfolio: [] };

    const [allEditors, allPortfolio] = await Promise.all([
      EditorsAPI.all(),
      PortfolioAPI.all(),
    ]);

    const editors = allEditors.filter(e => {
      const haystack = [
        e.nickname, e.role, e.bio,
        ...(e.skills || []), ...(e.software || []),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });

    const portfolio = allPortfolio.filter(p => {
      const haystack = [p.title, p.category, p.software].join(' ').toLowerCase();
      return haystack.includes(q);
    });

    return { editors, portfolio };
  },
};