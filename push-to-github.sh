#!/bin/bash

# DealOrbit GitHub Push Helper
echo "🚀 DealOrbit GitHub Push Helper"
echo "================================="
echo ""

# Check if remote is set
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "❌ GitHub remote not configured yet."
    echo ""
    echo "First, create a repository on GitHub:"
    echo "1. Go to https://github.com/new"
    echo "2. Create a new repository (make it PUBLIC)"
    echo "3. Copy the repository URL"
    echo ""
    read -p "Enter your GitHub repository URL (e.g., https://github.com/username/dealorbit.git): " repo_url
    
    if [ -n "$repo_url" ]; then
        git remote add origin "$repo_url"
        echo "✅ Remote added!"
    else
        echo "❌ No URL provided. Exiting."
        exit 1
    fi
fi

echo "📤 Pushing to GitHub..."
echo ""

# Check current branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ] && [ "$current_branch" != "master" ]; then
    echo "Renaming branch to 'main'..."
    git branch -M main
fi

# Add all changes
git add .

# Check if there are changes
if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit."
else
    read -p "Enter commit message (or press Enter for default): " commit_msg
    if [ -z "$commit_msg" ]; then
        commit_msg="Update DealOrbit website"
    fi
    git commit -m "$commit_msg"
fi

# Push to GitHub
echo ""
echo "Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Go to your repository on GitHub"
    echo "2. Click Settings → Pages"
    echo "3. Select 'main' branch and '/ (root)' folder"
    echo "4. Click Save"
    echo "5. Your site will be live at: https://YOUR_USERNAME.github.io/REPO_NAME/"
else
    echo ""
    echo "❌ Push failed. Please check:"
    echo "- Your GitHub repository exists"
    echo "- You have the correct permissions"
    echo "- Your internet connection"
fi







