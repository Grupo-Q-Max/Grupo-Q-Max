-- Copies the legacy CrmAutomationNotify.memberIds JSON arrays into CrmAutomationNotifyMember
-- and clears the JSON. Safe to run more than once. Ids of members that no longer exist are dropped.
-- Needs the table created by the deploy's `prisma db push` and MariaDB 10.6+ (JSON_TABLE).
-- Until it runs, the app reads both (lib/crm-automation-shared.ts notifyMemberIds), so nothing is missed.
-- Afterwards the column can be dropped by hand: ALTER TABLE CrmAutomationNotify DROP COLUMN memberIds;
-- (then remove `memberIds` from prisma/schema.prisma and from notifyMemberIds).

START TRANSACTION;

INSERT IGNORE INTO CrmAutomationNotifyMember (automationId, memberId)
SELECT n.automationId, ids.memberId
FROM CrmAutomationNotify n
JOIN JSON_TABLE(n.memberIds, '$[*]' COLUMNS (memberId VARCHAR(191) PATH '$')) ids
JOIN TeamMember m ON m.id = ids.memberId
WHERE n.memberIds IS NOT NULL;

UPDATE CrmAutomationNotify SET memberIds = NULL WHERE memberIds IS NOT NULL;

COMMIT;
