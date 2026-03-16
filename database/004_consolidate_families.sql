-- Consolidate duplicate families: move all members to the family with data, delete empty ones
DO $$
DECLARE
  v_good_family UUID;
  v_old_family UUID;
BEGIN
  -- The family with medications is the correct one
  SELECT DISTINCT family_id INTO v_good_family
  FROM medications WHERE active = true LIMIT 1;

  IF v_good_family IS NULL THEN
    RAISE NOTICE 'No family with medications found, skipping';
    RETURN;
  END IF;

  -- Find the other family (old empty one)
  SELECT f.id INTO v_old_family
  FROM families f
  WHERE f.id != v_good_family
    AND EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id = f.id)
  LIMIT 1;

  IF v_old_family IS NOT NULL THEN
    -- Move members from old family to new (skip if already there)
    UPDATE family_members
    SET family_id = v_good_family
    WHERE family_id = v_old_family
      AND user_id NOT IN (
        SELECT user_id FROM family_members WHERE family_id = v_good_family
      );

    -- Delete leftover memberships in old family
    DELETE FROM family_members WHERE family_id = v_old_family;

    -- Delete the old empty family
    DELETE FROM families WHERE id = v_old_family;

    RAISE NOTICE 'Moved members to family % and deleted old family %', v_good_family, v_old_family;
  ELSE
    RAISE NOTICE 'No duplicate families found, nothing to do';
  END IF;
END $$;
