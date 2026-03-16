-- Move Clare from old family (12f1ed52...) to Trevor's current family (f36899cd...)
-- and delete the old family

DO $$
DECLARE
  v_new_family UUID;
  v_old_family UUID;
BEGIN
  -- Trevor's family (the one named Matteo with imported data)
  SELECT id INTO v_new_family FROM families WHERE name = 'Matteo' LIMIT 1;

  -- Old family (Trevor's Family - the empty one Clare is stuck in)
  SELECT id INTO v_old_family FROM families WHERE name ILIKE '%Trevor%Family%' LIMIT 1;

  IF v_new_family IS NULL THEN
    RAISE EXCEPTION 'Could not find family named Matteo';
  END IF;

  IF v_old_family IS NULL OR v_old_family = v_new_family THEN
    RAISE NOTICE 'No old family to clean up';
    RETURN;
  END IF;

  RAISE NOTICE 'Moving members from % to %', v_old_family, v_new_family;

  -- Move members from old family to new (skip duplicates)
  UPDATE family_members
  SET family_id = v_new_family
  WHERE family_id = v_old_family
    AND user_id NOT IN (
      SELECT user_id FROM family_members WHERE family_id = v_new_family
    );

  -- Delete remaining memberships in old family (duplicates that couldn't move)
  DELETE FROM family_members WHERE family_id = v_old_family;

  -- Delete old family's children
  DELETE FROM children WHERE family_id = v_old_family;

  -- Delete old family's settings
  DELETE FROM settings WHERE family_id = v_old_family;

  -- Delete the old family
  DELETE FROM families WHERE id = v_old_family;

  RAISE NOTICE 'Done! Old family deleted, Clare should now be in family %', v_new_family;
END $$;
