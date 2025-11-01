# Login With Simples

A Next.js web app that demonstrates Firebase authentication with Google or email + password credentials. The UI highlights the signed-in email address based on the provider (blue for Google, red for email/password) and persists user profile data in Cloud Firestore.

## Features

- 🔐 Sign up or log in with Google OAuth or email/password.
- 🎨 Signed-in email address is color coded by provider.
- 🗒️ Personal note text field saves automatically as you type.
- 📋 "Interested?" dropdown persists the visitor's choice.
- 🕓 Firestore keeps a history of every signup and login event.
- ☁️ Ready to deploy on Vercel with environment-based secrets.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Firebase project and enable the following:

   - Authentication providers: **Google** and **Email/Password**.
   - Cloud Firestore database in production mode (or test mode with appropriate rules).

3. Configure the following environment variables in a `.env.local` file for local development (they will also be used as Vercel environment variables):

   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

   > **Note:** When deploying to Vercel, add the same variables in the project settings under **Environment Variables**. They are read at build and runtime.

4. Run the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the app.

## Data model

- `users/{uid}`: Stores profile information (email, provider, personal note, interested flag, timestamps).
- `userEvents/{autoId}`: Stores an entry for every sign up or login, including provider, timestamp, and email.

## Deployment

The project is preconfigured for Vercel deployment. After pushing to GitHub:

1. Create a new Vercel project connected to this repository.
2. Add the environment variables listed above in **Project Settings → Environment Variables**.
3. Trigger a deployment. Vercel will run `npm install` and `npm run build` automatically.

Once deployed, the application will read Firebase credentials from Vercel's environment, and all authentication events will be written to Firestore.
