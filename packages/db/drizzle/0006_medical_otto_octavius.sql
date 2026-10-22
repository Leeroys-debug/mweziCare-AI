ALTER TABLE "clinical"."rulesets" ADD COLUMN "approved_by_name" text;
--> statement-breakpoint
-- Hand-added (not drizzle-kit generated): enforces "Approved versions are
-- immutable" (CLAUDE.md / D2 rulesets spec) at the database layer, as
-- defense in depth alongside the application-level guard in
-- packages/db/src/rulesets.ts. The one allowed mutation to an already-
-- approved row is the automatic retirement that happens when a newer
-- version is approved (status -> 'retired', nothing else changes).
CREATE OR REPLACE FUNCTION clinical.prevent_approved_ruleset_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' THEN
      RAISE EXCEPTION 'Approved rulesets cannot be deleted (ruleset id %)', OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'approved' THEN
    IF NEW.status IS DISTINCT FROM 'retired'
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_by_name IS DISTINCT FROM OLD.approved_by_name
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Approved rulesets are immutable except for retirement (ruleset id %)', OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER rulesets_immutable_when_approved
  BEFORE UPDATE OR DELETE ON clinical.rulesets
  FOR EACH ROW EXECUTE FUNCTION clinical.prevent_approved_ruleset_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION clinical.prevent_approved_ruleset_rules_mutation()
RETURNS trigger AS $$
DECLARE
  target_ruleset_id uuid := COALESCE(NEW.ruleset_id, OLD.ruleset_id);
  current_status clinical.ruleset_status;
BEGIN
  SELECT status INTO current_status FROM clinical.rulesets WHERE id = target_ruleset_id;
  IF current_status = 'approved' THEN
    RAISE EXCEPTION 'Cannot modify rules belonging to an approved ruleset (ruleset id %)', target_ruleset_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER rules_immutable_when_ruleset_approved
  BEFORE INSERT OR UPDATE OR DELETE ON clinical.rules
  FOR EACH ROW EXECUTE FUNCTION clinical.prevent_approved_ruleset_rules_mutation();
