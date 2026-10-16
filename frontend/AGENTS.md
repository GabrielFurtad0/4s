<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the interactive demonstration state in the index route and pass it to focused seller, backoffice and management modules; this makes both environments share the same order and stock state without a backend.
- Keep commercial calculations and inventory transitions in src/lib/business.ts with numerical tests; this prevents inconsistent values across seller and backoffice views.
- This task is frontend-only: fiscal lookups, invoices, rents and executive historic values are clearly marked simulations; no real external service or persistence is implied.
