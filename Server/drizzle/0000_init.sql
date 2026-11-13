CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz,
  "scope" text,
  "password" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "title" text DEFAULT '' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "pinned" boolean DEFAULT false NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "is_daily" boolean DEFAULT false NOT NULL,
  "daily_date" text,
  "encrypted" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "version" integer DEFAULT 1 NOT NULL,
  "search_vector" tsvector
);

CREATE INDEX IF NOT EXISTS "notes_user_id_idx" ON "notes" ("user_id");
CREATE INDEX IF NOT EXISTS "notes_user_updated_idx" ON "notes" ("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "notes_version_idx" ON "notes" ("version");
CREATE INDEX IF NOT EXISTS "notes_search_vector_idx" ON "notes" USING gin ("search_vector");
CREATE UNIQUE INDEX IF NOT EXISTS "notes_user_daily_date_uidx"
  ON "notes" ("user_id", "daily_date")
  WHERE "daily_date" IS NOT NULL AND "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "color" text DEFAULT '#6366F1' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "version" integer DEFAULT 1 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "tags_user_name_uidx" ON "tags" ("user_id", "name");
CREATE INDEX IF NOT EXISTS "tags_user_id_idx" ON "tags" ("user_id");

CREATE TABLE IF NOT EXISTS "note_tags" (
  "note_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE cascade,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE cascade,
  PRIMARY KEY ("note_id", "tag_id")
);

CREATE TABLE IF NOT EXISTS "links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "source_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE cascade,
  "target_id" uuid REFERENCES "notes"("id") ON DELETE set null,
  "target_title" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "links_source_idx" ON "links" ("source_id");
CREATE INDEX IF NOT EXISTS "links_target_idx" ON "links" ("target_id");
CREATE INDEX IF NOT EXISTS "links_user_idx" ON "links" ("user_id");

CREATE TABLE IF NOT EXISTS "note_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "note_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "title" text DEFAULT '' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "reason" text DEFAULT 'edit' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "note_versions_note_idx" ON "note_versions" ("note_id");

CREATE TABLE IF NOT EXISTS "templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "version" integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS "reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "note_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "remind_at" timestamptz NOT NULL,
  "notification_id" text,
  "done" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "version" integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS "sync_meta" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "current_version" integer DEFAULT 0 NOT NULL
);
