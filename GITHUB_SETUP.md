# GitHub Pages Setup Guide for DealOrbit

## Step 1: Create a GitHub Account (if you don't have one)
1. Go to https://github.com
2. Click "Sign up" and create a free account

## Step 2: Create a New Repository
1. Log into GitHub
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Repository name: `dealorbit` (or any name you prefer)
5. Description: "DealOrbit Rotation Management System"
6. Make it **Public** (required for free GitHub Pages)
7. **DO NOT** initialize with README, .gitignore, or license (we already have files)
8. Click "Create repository"

## Step 3: Connect Your Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
cd /Volumes/DrewSanDisk/DealOrbit

# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/dealorbit.git

# Rename branch to main (if needed)
git branch -M main

# Push your code
git push -u origin main
```

## Step 4: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** (top menu)
3. Scroll down to **Pages** (left sidebar)
4. Under "Source", select:
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **Save**

## Step 5: Your Website URL

After a few minutes, your website will be live at:
```
https://YOUR_USERNAME.github.io/dealorbit/
```

(Replace YOUR_USERNAME with your actual GitHub username)

## Updating Your Website

Whenever you make changes:

```bash
cd /Volumes/DrewSanDisk/DealOrbit
git add .
git commit -m "Description of your changes"
git push
```

Changes will be live in 1-2 minutes!

## Troubleshooting

- If Pages doesn't work, make sure:
  - Repository is **Public** (not private)
  - You selected the `main` branch
  - You waited a few minutes for GitHub to build the site







