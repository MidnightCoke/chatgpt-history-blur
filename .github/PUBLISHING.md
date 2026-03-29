# GitHub Actions Chrome Web Store Publishing

This repository includes a GitHub Actions workflow at `.github/workflows/chrome-web-store.yml` that can package the extension and publish updates to the Chrome Web Store.

## Required GitHub repository secrets

Add these repository secrets in GitHub under Settings > Secrets and variables > Actions:

- `CHROME_EXTENSION_ID`: the extension ID from the Chrome Web Store Developer Dashboard.
- `CHROME_CLIENT_ID`: the OAuth client ID for the Chrome Web Store API.
- `CHROME_CLIENT_SECRET`: the OAuth client secret for the Chrome Web Store API.
- `CHROME_REFRESH_TOKEN`: the OAuth refresh token with the `https://www.googleapis.com/auth/chromewebstore` scope.

## Google and Chrome Web Store setup

Before automation can publish updates, create the extension item in the Chrome Web Store dashboard, complete the listing and privacy sections, and keep it as a draft if you are not ready to go live yet.

If version `1.1.0` is already published for this extension, automation should target that same existing store item by using its current extension ID in `CHROME_EXTENSION_ID`.

1. Enable 2-step verification on the Google account that owns the extension.
2. In Google Cloud Console, enable the Chrome Web Store API.
3. Configure an OAuth consent screen for an External app.
4. Create an OAuth client of type Web application.
5. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI.
6. Use the OAuth Playground with your own client credentials and request the `https://www.googleapis.com/auth/chromewebstore` scope.
7. Exchange the authorization code for tokens and copy the refresh token into `CHROME_REFRESH_TOKEN`.
8. In the Chrome Web Store Developer Dashboard, copy the extension ID into `CHROME_EXTENSION_ID`.

## How the workflow runs

- `workflow_dispatch`: packages the extension and uploads a zip artifact. If you set `publish` to `true`, it also submits the package to the Chrome Web Store.
- `push` on `master`: packages the extension on every push. It only publishes when the `manifest.json` version changed compared to the previous commit.

This prevents accidental failed publish attempts from normal code pushes without a version bump.

## Release process

1. Update the version in `manifest.json` to a value higher than the currently published version. If `1.1.0` is live, use something like `1.1.1` for the next release.
2. Commit and push your changes.
3. Wait for the workflow to upload and publish the new package.
4. Monitor review status in the Chrome Web Store dashboard.

## Notes

- The workflow packages only the files needed by the extension.
- The Chrome Web Store keeps the existing visibility settings when publishing through the API.
- The Chrome Web Store rejects uploads if the manifest version is not higher than the version already published.
- New versions still go through Chrome Web Store review unless the update qualifies for a review skip.