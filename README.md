# discord-azure-ad

This project provides a way for users verify that they have access to an account
with a specific Azure AD (Microsoft 365) tenant. For example, a university
discord server could use this to verify that users have access to a university
Microsoft 365 account and are related to the university in some way.

The code consists of a single-process NodeJS application that runs a Discord bot
for handling commands and a web server for authenticating with the Microsoft
Identity Platform.

## Flow

1. A User runs the `/verify` slash command in the Discord server
2. The bot replies with a link to begin the verification process (only visible
   to the user).
3. The user is prompted to sign in with Microsoft 365 Credentials. Only accounts in
   the configured tenant (organization) are allowed to proceed.
4. If the entire process succeeds, the bot assigns a role to the user.

## Setup and Requirements

The setup for using this application requires registering an application with
Discord, registering an application with Microsoft, and configuring the bot and
server to use all of the credentials. You also need to know or find out the
tenant ID of the organization that is allowed to verify.

First, have somewhere to deploy the application. Make sure it has a consistent
hostname and be prepared to set up a reverse-proxy such as
[Caddy](https://caddyserver.com/) to enable TLS (TLS is required for the
Microsoft portion of the setup).

Then, register an app with the [Microsoft Identity
Platform](https://docs.microsoft.com/en-us/graph/auth-register-app-v2) (if you
already use Azure, this can be done under App Registrations in Azure Portal):

1. Name: choose a name that users can easily identify.
2. Supported account types: `Accounts in any organizational directory`.
3. Redirect URI: use the path `/redirect` on domain. For example,
   `https://example.com/redirect`
4. Don't enable implicit grant and hybrid flows.
5. Create a client secret and note it down for later.

Next, register an app with the [Discord Developer Portal](https://discord.com/developers/applications).

1. Name: choose a good name.
2. Description: Put something your users will recognize.
3. Add a bot.
4. Disable public bot access, if desired (recommended).
5. Note down the token.
6. Under OAuth, generate a link with the following scopes and permissions:
   - Scopes: `bot`, `applications.commands`
   - Permissions: Manage roles
7. Use the generated OAuth2 URL to add your bot to the desired server.

Add a role on your server, such as "Verified". Make sure the role is below the
automatically-added role for the bot, because the bot needs permission to assign
that role to users.

Finally, to find the tenant ID for your organization, you can

- Follow the steps in https://docs.microsoft.com/en-us/onedrive/find-your-office-365-tenant-id, but your admins may restrict this;
- Use the Microsoft Graph API to make an API call to find the tenant ID
   1. Navigate to
   https://developer.microsoft.com/en-us/graph/graph-explorer?request=organization%3F%24select%3Did&method=GET&version=v1.0&GraphUrl=https://graph.microsoft.com;
   2. Sign in on the left using your organization account;
   3. Run the query.

## Running

The web interface runs on port 3000 by default.

Create a file called `.env` in the directory you want the bot to run (most
likely the root of the repo) with the following variables:

```sh
# Application credentials from Microsoft
DISCORD_AAD_CLIENT_ID=some-uuid
DISCORD_AAD_CLIENT_SECRET=some-random-string
# Tenant id (UUID) of your allowed organization
DISCORD_AAD_ALLOWED_TENANT=some-tenant-uuid
# Discord bot token
DISCORD_AAD_BOT_TOKEN=some-secret-value
# Role to assign to verified users
DISCORD_AAD_VERIFIED_ROLE_NAME=Verified
# The name of the organization to show on web pages.
DISCORD_AAD_ORG_NAME=My Organization
# A URL without the trailing slash that can access the web interface.
DISCORD_AAD_BASE_URL=https://example.com
# The port that the service will listen on.
DISCORD_AAD_PORT=3000
```

Keep this file secure as it contains credentials for both Microsoft and Discord.

Configure your reverse proxy, load balancer, or whatever, to forward traffic to
the web interface while providing TLS. Having TLS is a requirement from
Microsoft as they will not send OAuth2 redirects to endpoints without it.

### Docker

Modify the `-p` port mapping to whatever your deployment uses.

```sh
docker run --env-file .env -p 3000:3000 ghcr.io/gibstick/discord-azure-ad`
```

### Native

Install node version 16, npm version 7, then

```sh
npm run build
node dist/main.js
```

## Discord Slash Command Setup

As a temporary measure, only the server owner can deploy the slash commands to
the server. The server owner needs to send the message `!deploy` in a channel
the bot can access. The commands `/verify` and `/ping` should then be available
to run.
