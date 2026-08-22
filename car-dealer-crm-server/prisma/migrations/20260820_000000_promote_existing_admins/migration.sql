-- One-time grant: every account that existed when roles were introduced becomes
-- an admin, so the whole current team can reach the event log.
--
-- Deliberately NOT done via ADMIN_EMAILS: entries there are permanent and cannot
-- be demoted from the Users panel. Granting in the DB leaves every one of these
-- revocable later, which is the point of having a manager role at all.
-- New sign-ups still default to manager.
UPDATE "user"
SET role = 'admin'
WHERE lower(email) IN (
  'admin@royalautoclub.local',
  'royalautoclab@gmail.com',
  'filuknazarko@gmail.com',
  'andriyandriyrezerv@gmail.com'
);
