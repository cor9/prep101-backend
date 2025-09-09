-- Supabase Migration Script for PREP101
-- This script creates the database schema for the PREP101 application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Users table
CREATE TABLE IF NOT EXISTS "Users" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "password" VARCHAR(255) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "subscription" VARCHAR(20) DEFAULT 'free' CHECK ("subscription" IN ('free', 'basic', 'premium')),
  "subscriptionId" VARCHAR(255),
  "customerId" VARCHAR(255),
  "stripeCustomerId" VARCHAR(255),
  "stripeSubscriptionId" VARCHAR(255),
  "stripePriceId" VARCHAR(255),
  "subscriptionStatus" VARCHAR(20) DEFAULT 'active' CHECK ("subscriptionStatus" IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
  "currentPeriodStart" TIMESTAMP WITH TIME ZONE,
  "currentPeriodEnd" TIMESTAMP WITH TIME ZONE,
  "defaultPaymentMethodId" VARCHAR(255),
  "guidesUsed" INTEGER DEFAULT 0,
  "guidesLimit" INTEGER DEFAULT 1,
  "isBetaTester" BOOLEAN DEFAULT false,
  "betaAccessLevel" VARCHAR(20) DEFAULT 'none' CHECK ("betaAccessLevel" IN ('none', 'early', 'premium', 'admin')),
  "betaInvitedBy" UUID,
  "betaInvitedAt" TIMESTAMP WITH TIME ZONE,
  "betaStartedAt" TIMESTAMP WITH TIME ZONE,
  "betaFeedback" TEXT,
  "betaFeatures" JSONB DEFAULT '[]'::jsonb,
  "betaStatus" VARCHAR(20) DEFAULT 'invited' CHECK ("betaStatus" IN ('invited', 'active', 'completed', 'expired')),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Guides table
CREATE TABLE IF NOT EXISTS "Guides" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "guideId" VARCHAR(255) UNIQUE NOT NULL,
  "userId" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "characterName" VARCHAR(255) NOT NULL,
  "productionTitle" VARCHAR(255) NOT NULL,
  "productionType" VARCHAR(255) NOT NULL,
  "roleSize" VARCHAR(255) NOT NULL,
  "genre" VARCHAR(255) NOT NULL,
  "storyline" TEXT,
  "characterBreakdown" TEXT,
  "callbackNotes" TEXT,
  "focusArea" VARCHAR(255),
  "sceneText" TEXT NOT NULL,
  "generatedHtml" TEXT NOT NULL,
  "childGuideRequested" BOOLEAN DEFAULT false,
  "childGuideHtml" TEXT,
  "childGuideCompleted" BOOLEAN DEFAULT false,
  "shareUrl" VARCHAR(255),
  "isPublic" BOOLEAN DEFAULT false,
  "viewCount" INTEGER DEFAULT 0,
  "isFavorite" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_guides_user_id_created_at" ON "Guides"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_guides_guide_id" ON "Guides"("guideId");
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "Users"("email");
CREATE INDEX IF NOT EXISTS "idx_users_stripe_customer_id" ON "Users"("stripeCustomerId");

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "Users" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guides_updated_at BEFORE UPDATE ON "Guides" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Guides" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Users table
CREATE POLICY "Users can view own profile" ON "Users" FOR SELECT USING (auth.uid()::text = "id"::text);
CREATE POLICY "Users can update own profile" ON "Users" FOR UPDATE USING (auth.uid()::text = "id"::text);

-- Create RLS policies for Guides table
CREATE POLICY "Users can view own guides" ON "Guides" FOR SELECT USING (auth.uid()::text = "userId"::text);
CREATE POLICY "Users can create own guides" ON "Guides" FOR INSERT WITH CHECK (auth.uid()::text = "userId"::text);
CREATE POLICY "Users can update own guides" ON "Guides" FOR UPDATE USING (auth.uid()::text = "userId"::text);
CREATE POLICY "Users can delete own guides" ON "Guides" FOR DELETE USING (auth.uid()::text = "userId"::text);

-- Create a function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public."Users" (id, email, name, password)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', 'temp_password');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
