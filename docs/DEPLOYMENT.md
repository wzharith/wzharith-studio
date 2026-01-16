# Deployment Guide

This guide covers deploying the WZHarith Studio platform to GitHub Pages.

## Prerequisites

- GitHub account
- Git installed locally
- Node.js 18+ installed

## Step 1: Push to GitHub

```bash
# Initialize git (if not already)
cd wzharith-studio
git init

# Add all files
git add .
git commit -m "Initial commit"

# Create GitHub repository and push
# (Create repo on github.com first)
git remote add origin https://github.com/yourusername/your-repo-name.git
git branch -M main
git push -u origin main
```

## Step 2: Configure Repository

### 2.1 Update `next.config.js`

Set your repository name as the basePath:

```javascript
// platform/next.config.js
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/your-repo-name' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/your-repo-name/' : '',
};
```

### 2.2 Add GitHub Secrets

Go to: **Repository Settings > Secrets and variables > Actions**

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `INVOICE_PASSWORD` | Your invoice generator password |
| `GOOGLE_SCRIPT_URL` | (Optional) Google Apps Script URL |

## Step 3: Enable GitHub Pages

1. Go to **Repository Settings > Pages**
2. Under "Source", select **GitHub Actions**
3. The workflow will deploy automatically

## Step 4: Deploy

Push any change to `main` branch to trigger deployment:

```bash
git add .
git commit -m "Deploy update"
git push origin main
```

## Workflow Configuration

The deployment workflow is at `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install
        working-directory: ./platform

      - name: Build
        run: npm run build
        working-directory: ./platform
        env:
          NEXT_PUBLIC_INVOICE_PASSWORD: ${{ secrets.INVOICE_PASSWORD }}
          NEXT_PUBLIC_GOOGLE_SCRIPT_URL: ${{ secrets.GOOGLE_SCRIPT_URL }}

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./platform/out
          keep_files: true
```

## Custom Domain (Optional)

### 1. Add CNAME

Create `platform/public/CNAME`:

```
yourdomain.com
```

### 2. Configure DNS

Add these DNS records:

| Type | Name | Value |
|------|------|-------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | yourusername.github.io |

### 3. Update next.config.js

```javascript
// Remove basePath for custom domain
basePath: '',
assetPrefix: '',
```

### 4. Enable HTTPS

In GitHub Pages settings, check "Enforce HTTPS".

## Troubleshooting

### Build Fails

Check the Actions tab for error logs:

```bash
# Common fixes
npm install
npm run build
```

### 404 Errors

1. Check `basePath` matches repository name
2. Ensure `.nojekyll` file exists in `platform/public/`
3. Clear browser cache

### Secrets Not Working

1. Verify secret names match exactly (case-sensitive)
2. Rebuild after adding/changing secrets
3. Secrets are only available in production builds

### Images Not Loading

1. Use `assetPrefix` in next.config.js
2. Reference images with relative paths
3. Check image paths in production

### Invoice Generator Issues

1. Password secret must be `INVOICE_PASSWORD`
2. Access at: `https://yourusername.github.io/repo-name/invoice`

## Local Testing of Production Build

```bash
cd platform
npm run build
npx serve out
```

Visit http://localhost:3000/your-repo-name

## Updating the Site

Any push to `main` triggers a new deployment:

```bash
# Make changes
git add .
git commit -m "Update content"
git push origin main
```

Wait ~2-3 minutes for deployment to complete.

## Rolling Back

To rollback to a previous version:

```bash
# Find previous commit
git log --oneline

# Revert to specific commit
git revert HEAD
git push origin main

# Or reset to previous commit (destructive)
git reset --hard <commit-hash>
git push origin main --force
```

## Monitoring

- Check deployment status in Actions tab
- GitHub Pages shows deployment history
- Use browser DevTools for client-side debugging
