import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import findOrCreateUser from "../../services/auth.service.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("No email from Google"));

        const { user } = await findOrCreateUser({
          provider: "google",
          providerAccountId: profile.id,
          email,
          name: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    },
  ),
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "/auth/github/callback",
      scope: ["user:email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email)
          return done(new Error("GitHub account has no public email"));

        const { user } = await findOrCreateUser({
          provider: "github",
          providerAccountId: String(profile.id),
          email,
          name: profile.displayName || profile.username,
          avatarUrl: profile.photos?.[0]?.value,
        });
        done(null, user);
      } catch (err) {
        done(err);
      }
    },
  ),
);

export default passport;
