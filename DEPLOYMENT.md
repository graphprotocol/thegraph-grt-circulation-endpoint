# Vercel Deployment Documentation

This document explains how Vercel deployments are configured for the GRT Circulation Endpoint project.

## Deployment Strategy

The project uses a **selective branch deployment strategy** with the following configuration:

- **Production Deployments**: Automatically triggered by pushes to the `main` branch
- **Preview Deployments**: Only triggered for the `staging` branch via GitHub Actions
- **Other Branches**: No deployments (ignored)

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   main branch   │───▶│ Vercel (Direct)  │───▶│   Production    │
└─────────────────┘    └──────────────────┘    └─────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ staging branch  │───▶│ GitHub Actions   │───▶│ Vercel Preview  │
└─────────────────┘    └──────────────────┘    └─────────────────┘

┌─────────────────┐    ┌──────────────────┐
│ other branches  │───▶│   No Deployment  │
└─────────────────┘    └──────────────────┘
```

## Configuration Details

### 1. Vercel Project Settings

**Branch Tracking**: DISABLED
- This prevents Vercel from automatically deploying all branches
- Only `main` branch deploys directly through Vercel

**Production Branch**: `main`
- All pushes to `main` trigger production deployments
- Uses Vercel's automatic deployment system

### 2. GitHub Actions Workflow

**File**: `.github/workflows/deploy-staging.yml`

**Triggers**: 
- Only runs on pushes to `staging` branch
- Uses Node.js 22 to match Vercel's build environment

**Secrets Required** (in GitHub repository settings):
- `VERCEL_TOKEN`: Personal access token from Vercel
- `VERCEL_ORG_ID`: Your Vercel organization/team ID  
- `VERCEL_PROJECT_ID`: The specific project ID

**Workflow Steps**:
1. Checkout code
2. Setup Node.js 22 with yarn caching
3. Install dependencies with `yarn install --frozen-lockfile`
4. Deploy to Vercel using the `amondnet/vercel-action@v25`

### 3. Vercel Configuration

**File**: `vercel.json`

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "server.ts" }
  ],
  "git": {
    "deploymentEnabled": {
      "main": true,
      "staging": true
    }
  }
}
```

**Key Settings**:
- **Build**: Uses `@vercel/node` to build the TypeScript Express server
- **Routing**: All requests route to `server.ts`
- **Git Config**: Only `main` and `staging` branches are enabled for deployment

## How to Deploy

### Production Deployment
```bash
# Any push to main triggers production deployment
git checkout main
git merge your-feature-branch
git push origin main
```

### Preview Deployment (Staging)
```bash
# Any push to staging triggers preview deployment via GitHub Actions
git checkout staging
git merge your-feature-branch  
git push origin staging
```

### Testing Other Branches
```bash
# Pushes to other branches do NOT trigger any deployments
git checkout feature/my-feature
git push origin feature/my-feature  # No deployment triggered
```

## Environment Variables

The following environment variables must be configured in Vercel:

### Required
- `ETHERSCAN_API_KEY`: API key for Etherscan blockchain data
- `L2_SUBGRAPH_URL`: GraphQL endpoint for L2 supply data

### Optional  
- `RETRY_MAX_ATTEMPTS`: Number of retry attempts (default: 3)
- `RETRY_BASE_DELAY_MS`: Base delay for retries in ms (default: 1000)
- `ENABLE_SUPPLY_VALIDATION`: Enable supply validation (default: true)

## GitHub Secrets Configuration

To set up GitHub Actions deployment, configure these secrets in your repository:

1. Go to **GitHub Repository → Settings → Secrets and variables → Actions**
2. Add the following secrets:

### `VERCEL_TOKEN`
- Go to [Vercel Dashboard → Settings → Tokens](https://vercel.com/account/tokens)
- Create a new token with project access
- Copy the token value

### `VERCEL_ORG_ID` 
- Go to your Vercel project → **Settings → General**
- Find **Team ID** (this is your Org ID)
- Copy the value

### `VERCEL_PROJECT_ID`
- Go to your Vercel project → **Settings → General**  
- Find **Project ID**
- Copy the value

## Troubleshooting

### GitHub Actions Deployment Fails

**1. Check Node.js Version**
```yaml
# In .github/workflows/deploy-staging.yml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '22'  # Must match Vercel's Node version
```

**2. Verify Package Manager**
```yaml
# Use yarn (not npm) since project has yarn.lock
- name: Install dependencies
  run: yarn install --frozen-lockfile
```

**3. Check Secrets**
- Verify all three secrets are set in GitHub repository settings
- Ensure `VERCEL_TOKEN` has correct permissions
- Confirm `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` match your Vercel project

**4. Validate Dependencies**
- Ensure `package.json` and `yarn.lock` are in sync
- Check that all dependencies support the Node.js version being used

### Vercel Direct Deployment Issues

**1. Build Failures**
- Check Vercel build logs in the dashboard
- Verify environment variables are set correctly
- Ensure `server.ts` exports the Express app properly

**2. Runtime Errors**
- Check Vercel function logs
- Verify all required environment variables are configured
- Test endpoints locally first with `yarn dev`

### Branch Not Deploying

**1. For `main` branch**:
- Verify Vercel project is connected to correct repository
- Check that production branch is set to `main`
- Ensure repository permissions are correct

**2. For `staging` branch**:
- Check GitHub Actions workflow runs
- Verify workflow file exists in `.github/workflows/deploy-staging.yml`
- Confirm secrets are configured correctly

**3. For other branches**:
- This is expected behavior - other branches should NOT deploy
- Only `main` and `staging` branches are configured for deployment

## Making Changes

### Adding a New Branch for Deployment

**Option 1: GitHub Actions** (Recommended)
1. Copy `.github/workflows/deploy-staging.yml` to a new file
2. Change the branch trigger:
   ```yaml
   on:
     push:
       branches:
         - your-new-branch
   ```

**Option 2: Vercel Direct**
1. Update `vercel.json`:
   ```json
   "git": {
     "deploymentEnabled": {
       "main": true,
       "staging": true,
       "your-new-branch": true
     }
   }
   ```
2. Enable Branch Tracking in Vercel Dashboard (if using this approach)

### Disabling Staging Deployments

1. **Delete the GitHub Actions workflow**:
   ```bash
   rm .github/workflows/deploy-staging.yml
   ```

2. **Update `vercel.json`**:
   ```json
   "git": {
     "deploymentEnabled": {
       "main": true
     }
   }
   ```

### Changing Deployment Method

**From GitHub Actions to Vercel Direct**:
1. Enable Branch Tracking in Vercel Dashboard
2. Remove the GitHub Actions workflow file
3. Update `vercel.json` to include the branch

**From Vercel Direct to GitHub Actions**:
1. Disable Branch Tracking in Vercel Dashboard  
2. Create GitHub Actions workflow file
3. Configure the required secrets

## Security Considerations

- **Secrets Management**: Never commit Vercel tokens to the repository
- **Branch Protection**: Consider adding branch protection rules to `main`
- **Access Control**: Limit who can modify GitHub secrets and Vercel project settings
- **Token Rotation**: Regularly rotate Vercel access tokens

## Monitoring

### Deployment Status
- **Vercel Dashboard**: Monitor production deployments
- **GitHub Actions**: Monitor staging deployment workflows
- **Logs**: Check both Vercel function logs and GitHub Actions logs

### Performance
- Monitor deployment times in both Vercel and GitHub Actions
- Check build cache effectiveness
- Review bundle size and optimization

## Additional Resources

- [Vercel Deployment Documentation](https://vercel.com/docs/deployments)
- [GitHub Actions Vercel Integration](https://github.com/amondnet/vercel-action)
- [Vercel CLI Reference](https://vercel.com/docs/cli)