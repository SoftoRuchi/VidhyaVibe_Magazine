-- Magazine descriptions can be longer than VARCHAR(191)
ALTER TABLE magazines MODIFY COLUMN description TEXT NULL;
