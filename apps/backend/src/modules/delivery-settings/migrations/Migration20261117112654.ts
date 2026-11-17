import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117112654 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "delivery_settings" ("id" text not null, "whatsapp_number" text not null default '', "round_times" jsonb not null default '[]', "cutoff_minutes" integer not null default 30, "auto_cancel_minutes" integer not null default 120, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "delivery_settings_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_delivery_settings_deleted_at" ON "delivery_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "delivery_settings" cascade;`);
  }

}
