CREATE TABLE IF NOT EXISTS "unavailable_time_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_id" uuid NOT NULL,
	"date" date NOT NULL,
	"time" time NOT NULL,
	"is_unavailable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unavailable_time_slots" ADD CONSTRAINT "unavailable_time_slots_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
