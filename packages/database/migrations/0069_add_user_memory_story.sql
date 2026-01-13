CREATE TABLE IF NOT EXISTS "user_memory_story_diffs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"story_id" varchar(255),
	"diff" text,
	"snapshot" text,
	"summary" text,
	"reasoning" text,
	"memory_ids" jsonb,
	"source_ids" jsonb,
	"metadata" jsonb,
	"previous_version" integer,
	"next_version" integer,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memory_story_documents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" varchar(255),
	"summary" text,
	"story" text,
	"reasoning" text,
	"memory_ids" jsonb,
	"source_ids" jsonb,
	"metadata" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_memory_story_diffs" ADD CONSTRAINT "user_memory_story_diffs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memory_story_diffs" ADD CONSTRAINT "user_memory_story_diffs_story_id_user_memory_story_documents_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."user_memory_story_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memory_story_documents" ADD CONSTRAINT "user_memory_story_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_story_diffs_story_id_index" ON "user_memory_story_diffs" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_story_diffs_user_id_index" ON "user_memory_story_diffs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_story_documents_user_id_unique" ON "user_memory_story_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_story_documents_user_id_index" ON "user_memory_story_documents" USING btree ("user_id");
