This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Google Sheets Integration

This project reads and writes data to Google Sheets. To allow this integration:

- Go to https://console.cloud.google.com/
- Select IAM & Admin, then select Service Accounts
- Create a new Service Account.
- The service account comes with an email address that ends in @cosmic-anthem-412619.iam.gserviceaccount.com -- share the Google sheet to access with this account.
- Download the service account details as JSON -- this should include a private key and client email.
- Save the private key and client email as local environment variables -- you can use these in GooglAuth in route.ts files.
- The first time you access the spreadsheets, you'll get an error message prompting you to enable Google Sheets API -- follow the instructions in the error message to do so.
- The spreadsheets IDs you would like to access can also be saved as local environment variables.
