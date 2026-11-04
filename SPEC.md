# Scope and acceptance criteria

DeliveryLab is a bounded educational simulator, with actual backend computation and no external network delivery.

Required: five scenarios, configurable event count/retry budget/delay/seed, deterministic jitter, transient/permanent classification, receiver deduplication comparison, attempt timeline, receiver effects table, dead-letter queue with recovery, event filtering, JSON export, responsive layout, help, local setup, automated engine/API checks, Vercel deployment.

Out of scope: real webhook targets, unattended workers, accounts, persistent server queues, a database and exactly-once network delivery.
