import NextAuth from "next-auth"
import LinkedInProvider from "next-auth/providers/linkedin"
import TwitterProvider from "next-auth/providers/twitter"
import FacebookProvider from "next-auth/providers/facebook"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID || "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
      authorization: {
        params: { scope: 'openid profile email w_member_social' },
      },
      issuer: 'https://www.linkedin.com/oauth',
      jwks_endpoint: 'https://www.linkedin.com/oauth/openid/jwks',
      profile(profile, tokens) {
        const defaultImage =
          'https://cdn-icons-png.flaticon.com/512/174/174857.png';
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture || defaultImage,
        };
      },
    }),
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID || "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
      version: "2.0",
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid profile email https://www.googleapis.com/auth/youtube.upload",
        },
      },
    }),
    {
      id: "tiktok",
      name: "TikTok",
      type: "oauth",
      version: "2.0",
      allowDangerousEmailAccountLinking: true,
      checks: ["pkce", "state"],
      authorization: {
        url: `https://www.tiktok.com/v2/auth/authorize?client_key=${process.env.TIKTOK_CLIENT_KEY || "aw8v2r19cmj7b4ao"}`,
        params: {
          response_type: "code",
          scope: "user.info.basic",
          redirect_uri: (process.env.NEXTAUTH_URL ? process.env.NEXTAUTH_URL.replace(/\/$/, "") : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")) + "/api/test-tiktok",
        },
      },
      token: {
        url: "https://open.tiktokapis.com/v2/oauth/token/",
        async request(context) {
          const { provider, params: { code }, client } = context;
          const response = await fetch(provider.token.url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_key: provider.clientId,
              client_secret: provider.clientSecret,
              code,
              grant_type: "authorization_code",
              redirect_uri: provider.authorization.params.redirect_uri,
            }),
          });
          const tokens = await response.json();
          return { tokens };
        }
      },
      userinfo: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
      profile(profile) {
        return {
          id: profile?.data?.user?.open_id || "tiktok_dummy_id",
          name: profile?.data?.user?.display_name || "TikTok User",
          email: `${profile?.data?.user?.open_id || "tiktok_dummy_id"}@tiktok.com`,
          image: profile?.data?.user?.avatar_url,
        }
      },
      clientId: process.env.TIKTOK_CLIENT_KEY || "",
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
    }
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.tier = user.tier; // Pass tier to the frontend
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "supersecret123"
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
