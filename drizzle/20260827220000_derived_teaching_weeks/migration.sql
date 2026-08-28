-- The Week letter becomes a calculation, and seeding is removed (issue #161, ADR-0020). The
-- stored Teaching Week rows are dropped, and so is the Term name column — names are derived
-- from a Term's position in the year, so a stored name can only contradict the derived one.
ALTER TABLE `term` DROP COLUMN `name`;
DROP TABLE `teaching_week`;
