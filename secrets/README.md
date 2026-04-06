# secrets/ directory

This directory contains sensitive files that are NEVER committed to git.

## Required files:

### google-play-key.json
Google Play service account key for automated publishing via EAS Submit.

How to get it:
1. Google Play Console → Setup → API access
2. Link to a Google Cloud project
3. Create a service account with "Release manager" role
4. Download JSON key → save as `google-play-key.json` in this folder

### google-services.json (alternative location)
Firebase config for push notifications.
Primary location: `mobile/google-services.json`
This folder copy is a backup only.

## Security note:
All files in this directory are in .gitignore.
Never share or commit these files.
Store them in a password manager (1Password, Bitwarden) as backup.
