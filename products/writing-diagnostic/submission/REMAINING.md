# Public submission status

The source fixes, review-case definitions, icon references, release notes, and deployment files are included. The archive is usable as a local development package. It is not ready to submit publicly.

1. Deploy the server to a public HTTPS endpoint. Vercel deployment was attempted in this session and blocked by automatic approval review because source upload/public hosting needs explicit authorization.
2. Set the unique widget origin with `WIDGET_ORIGIN`, or verify the deployed `VERCEL_PROJECT_PRODUCTION_URL` value. Do not use a placeholder domain.
3. Publish the product, support, privacy, and terms pages. The product page is prepared in `public/index.html`. Support contact arrangements and policy decisions have not been supplied.
4. Confirm the intended verified publisher identity and supported countries. The package preserves the supplied author name, Matt Lane. It does not attest that identity verification has been completed.
5. Connect the endpoint in ChatGPT developer mode and test all five positive and three negative cases against the installed skill and UI.
6. Record the real installed-host walkthrough, host the recording where reviewers can access it, and verify playback. `demo-walkthrough.md` is a recording guide, not a completed recording.
7. Copy `public-settings.example.json`, fill every field with verified values, and run `node scripts/prepare-public.js /absolute/path/to/completed-settings.json`. Use `"all"` for countries only if that is the intended targeting; otherwise provide explicit country codes. The script checks endpoint discovery and URL availability. Separately inspect page coverage and recording playback.
8. Rebuild the ZIP, upload a draft, complete the domain challenge and automated scans, resolve required findings, and have the publisher complete the portal attestations before submission.

No legal commitments, support address, recording URL, or deployment endpoint have been invented. The implementation contains no purchases or payments, so its commerce declaration is false. Country targeting is omitted pending an explicit choice.
