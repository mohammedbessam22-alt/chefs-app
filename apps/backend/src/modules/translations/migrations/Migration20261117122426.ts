import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117122426 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "chefs_translation" drop constraint if exists "chefs_translation_entity_type_entity_id_locale_unique";`);
    this.addSql(`create table if not exists "chefs_translation" ("id" text not null, "entity_type" text check ("entity_type" in ('product', 'category', 'collection')) not null, "entity_id" text not null, "locale" text check ("locale" in ('ckb', 'tk', 'en')) not null, "title" text not null, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "chefs_translation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_chefs_translation_deleted_at" ON "chefs_translation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chefs_translation_entity_type_entity_id_locale_unique" ON "chefs_translation" ("entity_type", "entity_id", "locale") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "chefs_translation" cascade;`);
  }

}
